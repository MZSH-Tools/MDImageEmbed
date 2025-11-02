/*
MDImageEmbed - Obsidian Plugin
将 Markdown 图片转换为 Base64 内嵌格式
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MDImageEmbedPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  showConversionLog: false,
  showDetailedLog: false,
  convertWikiLinks: true,
  skipBase64Images: true,
  prefixFilePath: "",
  suffixFilePath: ""
};
var MDImageEmbedPlugin = class extends import_obsidian.Plugin {
  // ========== 插件生命周期 ==========
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MDImageEmbedSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof import_obsidian.TFile && file.extension === "md") {
          this.addFileMenuItems(menu, file);
        }
      })
    );
    console.log("MD Image Embed plugin loaded");
  }
  onunload() {
    console.log("MD Image Embed plugin unloaded");
  }
  // ========== 设置管理 ==========
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  // ========== 右键菜单 ==========
  addFileMenuItems(menu, file) {
    menu.addItem((item) => {
      item.setTitle("Copy as Base64 format").setIcon("clipboard-copy").onClick(async () => {
        await this.copyAsBase64(file);
      });
    });
  }
  // ========== 辅助方法: 读取前缀/后缀文件内容 ==========
  async readTemplateFile(filePath) {
    if (!filePath || filePath.trim() === "") {
      return "";
    }
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath.trim());
      if (file instanceof import_obsidian.TFile) {
        const content = await this.app.vault.read(file);
        if (this.settings.showConversionLog) {
          console.log(`[MDImageEmbed] \u6210\u529F\u8BFB\u53D6\u6A21\u677F\u6587\u4EF6: ${filePath}`);
        }
        return content;
      } else {
        if (this.settings.showConversionLog) {
          console.warn(`[MDImageEmbed] \u6A21\u677F\u6587\u4EF6\u672A\u627E\u5230: ${filePath}`);
        }
        return "";
      }
    } catch (error) {
      if (this.settings.showConversionLog) {
        console.error(`[MDImageEmbed] \u8BFB\u53D6\u6A21\u677F\u6587\u4EF6\u5931\u8D25: ${filePath}`, error);
      }
      return "";
    }
  }
  // ========== 功能 1: 复制到剪贴板 ==========
  async copyAsBase64(file) {
    try {
      let content = await this.app.vault.read(file);
      const prefix = await this.readTemplateFile(this.settings.prefixFilePath);
      if (prefix) {
        content = prefix + "\n\n" + content;
      }
      const suffix = await this.readTemplateFile(this.settings.suffixFilePath);
      if (suffix) {
        content = content + "\n\n" + suffix;
      }
      const result = await this.convertMarkdownToBase64(content, file);
      await navigator.clipboard.writeText(result.content);
      if (this.settings.showConversionLog) {
        this.showDetailedResults(result);
      } else {
        new import_obsidian.Notice("\u2705 Copied as Base64 format");
      }
    } catch (error) {
      new import_obsidian.Notice("\u274C Failed to copy: " + error.message);
      console.error("Copy failed:", error);
    }
  }
  // ========== 显示详细处理结果 ==========
  showDetailedResults(result) {
    const total = result.convertedCount + result.skippedCount;
    let message = "\u2705 Copied to clipboard\n\n";
    message += `\u{1F4CA} Summary: ${total} images
`;
    message += `   \u2022 Converted: ${result.convertedCount}
`;
    message += `   \u2022 Skipped: ${result.skippedCount}`;
    if (this.settings.showDetailedLog) {
      message += "\n\n";
      const maxDisplay = 8;
      const detailsToShow = result.details.slice(0, maxDisplay);
      for (const detail of detailsToShow) {
        const fileName = detail.path.split("/").pop() || detail.path;
        const shortName = fileName.length > 35 ? fileName.substring(0, 32) + "..." : fileName;
        if (detail.status === "success") {
          message += `\u2713 ${shortName}
`;
        } else if (detail.status === "failed") {
          message += `\u2717 ${shortName}
  \u2192 ${detail.reason}
`;
        } else if (detail.status === "skipped") {
          message += `\u2298 ${shortName}
  \u2192 ${detail.reason}
`;
        }
      }
      if (result.details.length > maxDisplay) {
        const remaining = result.details.length - maxDisplay;
        message += `
... and ${remaining} more`;
      }
    }
    message += `

\u{1F4A1} Console (Ctrl+Shift+I) for full details`;
    new import_obsidian.Notice(message, 8e3);
  }
  // ========== 核心转换逻辑 ==========
  async convertMarkdownToBase64(content, sourceFile) {
    const imgRegex = /!\[([^\]]*)\]\(<?([^)">]+)>?\)|!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]/gi;
    let result = content;
    let convertedCount = 0;
    let skippedCount = 0;
    const details = [];
    const matches = [...content.matchAll(imgRegex)];
    if (this.settings.showConversionLog) {
      console.log(`[MDImageEmbed] \u5F00\u59CB\u5904\u7406\u6587\u6863\uFF0C\u5171\u627E\u5230 ${matches.length} \u4E2A\u56FE\u7247`);
    }
    for (const match of matches) {
      const fullMatch = match[0];
      if (match[1] !== void 0) {
        const altText = match[1];
        const imagePath = match[2];
        if (this.settings.skipBase64Images && imagePath.startsWith("data:image")) {
          skippedCount++;
          const displayPath = imagePath.substring(0, 30) + "...";
          details.push({ path: displayPath, status: "skipped", reason: "Already Base64" });
          if (this.settings.showConversionLog) {
            console.log(`[\u8DF3\u8FC7] ${displayPath} - \u539F\u56E0: \u5DF2\u662F Base64 \u683C\u5F0F`);
          }
          continue;
        }
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
          skippedCount++;
          details.push({ path: imagePath, status: "skipped", reason: "Network image (not supported)" });
          if (this.settings.showConversionLog) {
            console.log(`[\u8DF3\u8FC7] ${imagePath} - \u539F\u56E0: \u7F51\u7EDC\u56FE\u7247\u4E0D\u652F\u6301\u8F6C\u6362`);
          }
          continue;
        }
        const base64 = await this.imageToBase64(imagePath, sourceFile);
        if (base64) {
          result = result.replace(fullMatch, `![${altText}](${base64})`);
          convertedCount++;
          details.push({ path: imagePath, status: "success" });
          if (this.settings.showConversionLog) {
            console.log(`[\u6210\u529F] ${imagePath} - \u5DF2\u8F6C\u6362\u4E3A Base64`);
          }
        } else {
          skippedCount++;
          details.push({ path: imagePath, status: "failed", reason: "File not found" });
          if (this.settings.showConversionLog) {
            console.log(`[\u5931\u8D25] ${imagePath} - \u539F\u56E0: \u6587\u4EF6\u672A\u627E\u5230\u6216\u8BFB\u53D6\u5931\u8D25`);
          }
        }
      } else if (match[3] !== void 0) {
        const imageName = match[3];
        const displayPath = `![[${imageName}]]`;
        if (!this.settings.convertWikiLinks) {
          skippedCount++;
          details.push({ path: displayPath, status: "skipped", reason: "Wiki link conversion disabled" });
          if (this.settings.showConversionLog) {
            console.log(`[\u8DF3\u8FC7] ${displayPath} - \u539F\u56E0: Wiki \u94FE\u63A5\u8F6C\u6362\u5DF2\u7981\u7528`);
          }
          continue;
        }
        const base64 = await this.imageToBase64(imageName, sourceFile);
        if (base64) {
          result = result.replace(fullMatch, `![${imageName}](${base64})`);
          convertedCount++;
          details.push({ path: displayPath, status: "success" });
          if (this.settings.showConversionLog) {
            console.log(`[\u6210\u529F] ${displayPath} - \u5DF2\u8F6C\u6362\u4E3A Base64`);
          }
        } else {
          skippedCount++;
          details.push({ path: displayPath, status: "failed", reason: "File not found" });
          if (this.settings.showConversionLog) {
            console.log(`[\u5931\u8D25] ${displayPath} - \u539F\u56E0: \u6587\u4EF6\u672A\u627E\u5230\u6216\u8BFB\u53D6\u5931\u8D25`);
          }
        }
      }
    }
    if (this.settings.showConversionLog) {
      console.log(`[MDImageEmbed] \u5904\u7406\u5B8C\u6210: ${convertedCount} \u4E2A\u6210\u529F, ${skippedCount} \u4E2A\u8DF3\u8FC7`);
    }
    return { content: result, convertedCount, skippedCount, details };
  }
  // ========== 图片转 Base64 ==========
  async imageToBase64(imagePath, sourceFile) {
    try {
      const imageFile = this.resolveImagePath(imagePath, sourceFile);
      if (!imageFile) {
        if (this.settings.showConversionLog) {
          console.warn(`  \u2514\u2500 \u8DEF\u5F84\u89E3\u6790\u5931\u8D25: \u5728\u4EE5\u4E0B\u4F4D\u7F6E\u90FD\u672A\u627E\u5230\u6587\u4EF6`);
          console.warn(`     - Vault \u6839\u76EE\u5F55: ${imagePath}`);
          if (sourceFile.parent) {
            console.warn(`     - \u76F8\u5BF9\u8DEF\u5F84: ${sourceFile.parent.path}/${imagePath}`);
          }
        }
        return null;
      }
      if (this.settings.showConversionLog) {
        console.log(`  \u2514\u2500 \u6587\u4EF6\u5DF2\u627E\u5230: ${imageFile.path}`);
      }
      const arrayBuffer = await this.app.vault.readBinary(imageFile);
      const base64 = this.arrayBufferToBase64(arrayBuffer);
      const mimeType = this.getMimeType(imageFile.extension);
      if (this.settings.showConversionLog) {
        const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);
        console.log(`  \u2514\u2500 \u6587\u4EF6\u5927\u5C0F: ${sizeKB} KB, MIME: ${mimeType}`);
      }
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      if (this.settings.showConversionLog) {
        console.error(`  \u2514\u2500 \u8BFB\u53D6\u6216\u8F6C\u6362\u5931\u8D25: ${error.message}`);
      }
      return null;
    }
  }
  // ========== 路径解析 ==========
  resolveImagePath(imagePath, sourceFile) {
    let cleanPath = imagePath.replace(/^<|>$/g, "").trim();
    try {
      const decoded = decodeURIComponent(cleanPath);
      if (decoded !== cleanPath) {
        if (this.settings.showConversionLog) {
          console.log(`  \u2514\u2500 URL \u89E3\u7801: "${cleanPath}" \u2192 "${decoded}"`);
        }
      }
      cleanPath = decoded;
    } catch (e) {
      if (this.settings.showConversionLog) {
        console.warn(`  \u2514\u2500 URL \u89E3\u7801\u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u8DEF\u5F84: ${cleanPath}`);
      }
    }
    let file = this.app.vault.getAbstractFileByPath(cleanPath);
    if (file instanceof import_obsidian.TFile) {
      if (this.settings.showConversionLog) {
        console.log(`  \u2514\u2500 \u89E3\u6790\u65B9\u6CD5: Vault \u6839\u76EE\u5F55`);
      }
      return file;
    }
    if (sourceFile.parent) {
      const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
      file = this.app.vault.getAbstractFileByPath(relativePath);
      if (file instanceof import_obsidian.TFile) {
        if (this.settings.showConversionLog) {
          console.log(`  \u2514\u2500 \u89E3\u6790\u65B9\u6CD5: \u76F8\u5BF9\u8DEF\u5F84 (${sourceFile.parent.path}/)`);
        }
        return file;
      }
    }
    const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
    if (resolvedFile instanceof import_obsidian.TFile) {
      if (this.settings.showConversionLog) {
        console.log(`  \u2514\u2500 \u89E3\u6790\u65B9\u6CD5: Obsidian \u94FE\u63A5\u89E3\u6790`);
      }
      return resolvedFile;
    }
    return null;
  }
  // ========== ArrayBuffer 转 Base64 ==========
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  // ========== 获取 MIME 类型 ==========
  getMimeType(extension) {
    const mimeTypes = {
      "png": "image/png",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "gif": "image/gif",
      "webp": "image/webp",
      "svg": "image/svg+xml",
      "bmp": "image/bmp"
    };
    return mimeTypes[extension.toLowerCase()] || "image/png";
  }
};
var MDImageEmbedSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MD Image Embed Settings" });
    new import_obsidian.Setting(containerEl).setName("Show conversion log").setDesc("Display summary information in notifications").addToggle((toggle) => toggle.setValue(this.plugin.settings.showConversionLog).onChange(async (value) => {
      this.plugin.settings.showConversionLog = value;
      await this.plugin.saveSettings();
      this.display();
    }));
    if (this.plugin.settings.showConversionLog) {
      new import_obsidian.Setting(containerEl).setName("Show detailed log").setDesc('Show individual image status in notifications (requires "Show conversion log")').addToggle((toggle) => toggle.setValue(this.plugin.settings.showDetailedLog).onChange(async (value) => {
        this.plugin.settings.showDetailedLog = value;
        await this.plugin.saveSettings();
      }));
    }
    new import_obsidian.Setting(containerEl).setName("Convert Wiki links").setDesc("Convert Obsidian Wiki links (![[image.png]]) to standard Markdown with Base64").addToggle((toggle) => toggle.setValue(this.plugin.settings.convertWikiLinks).onChange(async (value) => {
      this.plugin.settings.convertWikiLinks = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Skip Base64 images").setDesc("Skip images that are already in Base64 format").addToggle((toggle) => toggle.setValue(this.plugin.settings.skipBase64Images).onChange(async (value) => {
      this.plugin.settings.skipBase64Images = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Anti-reprint Protection" });
    new import_obsidian.Setting(containerEl).setName("Prefix file path").setDesc('Path to markdown file to prepend (e.g., "templates/prefix.md"). Leave empty to disable.').addText((text) => text.setPlaceholder("templates/prefix.md").setValue(this.plugin.settings.prefixFilePath).onChange(async (value) => {
      this.plugin.settings.prefixFilePath = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Suffix file path").setDesc('Path to markdown file to append (e.g., "templates/suffix.md"). Leave empty to disable.').addText((text) => text.setPlaceholder("templates/suffix.md").setValue(this.plugin.settings.suffixFilePath).onChange(async (value) => {
      this.plugin.settings.suffixFilePath = value.trim();
      await this.plugin.saveSettings();
    }));
  }
};
/**
 * MDImageEmbed - Obsidian Plugin
 * Convert local images in Markdown to Base64 embedded format
 *
 * @author mengzhishanghun
 * @license MIT
 */
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBNREltYWdlRW1iZWQgLSBPYnNpZGlhbiBQbHVnaW5cbiAqIENvbnZlcnQgbG9jYWwgaW1hZ2VzIGluIE1hcmtkb3duIHRvIEJhc2U2NCBlbWJlZGRlZCBmb3JtYXRcbiAqXG4gKiBAYXV0aG9yIG1lbmd6aGlzaGFuZ2h1blxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbmltcG9ydCB7IFBsdWdpbiwgVEZpbGUsIE5vdGljZSwgTWVudSwgUGx1Z2luU2V0dGluZ1RhYiwgQXBwLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vLyA9PT09PT09PT09IFx1OEJCRVx1N0Y2RVx1NjNBNVx1NTNFMyA9PT09PT09PT09XG5pbnRlcmZhY2UgTURJbWFnZUVtYmVkU2V0dGluZ3Mge1xuXHRzaG93Q29udmVyc2lvbkxvZzogYm9vbGVhbjsgICAgICAgIC8vIFx1NjYyRlx1NTQyNlx1NjYzRVx1NzkzQVx1OEY2Q1x1NjM2Mlx1NjVFNVx1NUZEN1xuXHRzaG93RGV0YWlsZWRMb2c6IGJvb2xlYW47ICAgICAgICAgICAvLyBcdTY2MkZcdTU0MjZcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdUZGMDhcdTZCQ0ZcdTRFMkFcdTU2RkVcdTcyNDdcdTc2ODRcdTcyQjZcdTYwMDFcdUZGMDlcblx0Y29udmVydFdpa2lMaW5rczogYm9vbGVhbjsgICAgICAgICAgLy8gXHU2NjJGXHU1NDI2XHU4RjZDXHU2MzYyIFdpa2kgXHU5NEZFXHU2M0E1XG5cdHNraXBCYXNlNjRJbWFnZXM6IGJvb2xlYW47ICAgICAgICAgIC8vIFx1NjYyRlx1NTQyNlx1OERGM1x1OEZDN1x1NURGMlx1NjcwOSBCYXNlNjRcblx0cHJlZml4RmlsZVBhdGg6IHN0cmluZzsgICAgICAgICAgICAgLy8gXHU1MjREXHU3RjAwXHU2NTg3XHU0RUY2XHU4REVGXHU1Rjg0XHVGRjA4XHU2REZCXHU1MkEwXHU1MjMwXHU2NTg3XHU3QUUwXHU1RjAwXHU1OTM0XHVGRjA5XG5cdHN1ZmZpeEZpbGVQYXRoOiBzdHJpbmc7ICAgICAgICAgICAgIC8vIFx1NTQwRVx1N0YwMFx1NjU4N1x1NEVGNlx1OERFRlx1NUY4NFx1RkYwOFx1NkRGQlx1NTJBMFx1NTIzMFx1NjU4N1x1N0FFMFx1N0VEM1x1NUMzRVx1RkYwOVxufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBNREltYWdlRW1iZWRTZXR0aW5ncyA9IHtcblx0c2hvd0NvbnZlcnNpb25Mb2c6IGZhbHNlLFxuXHRzaG93RGV0YWlsZWRMb2c6IGZhbHNlLFxuXHRjb252ZXJ0V2lraUxpbmtzOiB0cnVlLFxuXHRza2lwQmFzZTY0SW1hZ2VzOiB0cnVlLFxuXHRwcmVmaXhGaWxlUGF0aDogJycsXG5cdHN1ZmZpeEZpbGVQYXRoOiAnJ1xufVxuXG4vLyA9PT09PT09PT09IFx1NEUzQlx1NjNEMlx1NEVGNlx1N0M3QiA9PT09PT09PT09XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNREltYWdlRW1iZWRQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogTURJbWFnZUVtYmVkU2V0dGluZ3M7XG5cblx0Ly8gPT09PT09PT09PSBcdTYzRDJcdTRFRjZcdTc1MUZcdTU0N0RcdTU0NjhcdTY3MUYgPT09PT09PT09PVxuXHRhc3luYyBvbmxvYWQoKSB7XG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuXHRcdC8vIFx1NkNFOFx1NTE4Q1x1OEJCRVx1N0Y2RVx1OTc2Mlx1Njc3RlxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTURJbWFnZUVtYmVkU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG5cdFx0Ly8gXHU2Q0U4XHU1MThDXHU2NTg3XHU0RUY2XHU4M0RDXHU1MzU1XHU0RThCXHU0RUY2XHVGRjA4XHU1M0YzXHU5NTJFXHU4M0RDXHU1MzU1XHVGRjA5XG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW1lbnUnLCAobWVudSwgZmlsZSkgPT4ge1xuXHRcdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uID09PSAnbWQnKSB7XG5cdFx0XHRcdFx0dGhpcy5hZGRGaWxlTWVudUl0ZW1zKG1lbnUsIGZpbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRjb25zb2xlLmxvZygnTUQgSW1hZ2UgRW1iZWQgcGx1Z2luIGxvYWRlZCcpO1xuXHR9XG5cblx0b251bmxvYWQoKSB7XG5cdFx0Y29uc29sZS5sb2coJ01EIEltYWdlIEVtYmVkIHBsdWdpbiB1bmxvYWRlZCcpO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdThCQkVcdTdGNkVcdTdCQTFcdTc0MDYgPT09PT09PT09PVxuXHRhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG5cdH1cblxuXHRhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU1M0YzXHU5NTJFXHU4M0RDXHU1MzU1ID09PT09PT09PT1cblx0YWRkRmlsZU1lbnVJdGVtcyhtZW51OiBNZW51LCBmaWxlOiBURmlsZSkge1xuXHRcdC8vIFx1ODNEQ1x1NTM1NVx1OTg3OTogXHU1OTBEXHU1MjM2XHU0RTNBIEJhc2U2NCBcdTY4M0NcdTVGMEZcdTUyMzBcdTUyNkFcdThEMzRcdTY3N0Zcblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW1cblx0XHRcdFx0LnNldFRpdGxlKCdDb3B5IGFzIEJhc2U2NCBmb3JtYXQnKVxuXHRcdFx0XHQuc2V0SWNvbignY2xpcGJvYXJkLWNvcHknKVxuXHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jb3B5QXNCYXNlNjQoZmlsZSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdThGODVcdTUyQTlcdTY1QjlcdTZDRDU6IFx1OEJGQlx1NTNENlx1NTI0RFx1N0YwMC9cdTU0MEVcdTdGMDBcdTY1ODdcdTRFRjZcdTUxODVcdTVCQjkgPT09PT09PT09PVxuXHRhc3luYyByZWFkVGVtcGxhdGVGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGlmICghZmlsZVBhdGggfHwgZmlsZVBhdGgudHJpbSgpID09PSAnJykge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHQvLyBcdTVDMURcdThCRDVcdTRFQ0UgVmF1bHQgXHU0RTJEXHU4QkZCXHU1M0Q2XHU2NTg3XHU0RUY2XG5cdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoLnRyaW0oKSk7XG5cdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbTURJbWFnZUVtYmVkXSBcdTYyMTBcdTUyOUZcdThCRkJcdTUzRDZcdTZBMjFcdTY3N0ZcdTY1ODdcdTRFRjY6ICR7ZmlsZVBhdGh9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgW01ESW1hZ2VFbWJlZF0gXHU2QTIxXHU2NzdGXHU2NTg3XHU0RUY2XHU2NzJBXHU2MjdFXHU1MjMwOiAke2ZpbGVQYXRofWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgW01ESW1hZ2VFbWJlZF0gXHU4QkZCXHU1M0Q2XHU2QTIxXHU2NzdGXHU2NTg3XHU0RUY2XHU1OTMxXHU4RDI1OiAke2ZpbGVQYXRofWAsIGVycm9yKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1NTI5Rlx1ODBGRCAxOiBcdTU5MERcdTUyMzZcdTUyMzBcdTUyNkFcdThEMzRcdTY3N0YgPT09PT09PT09PVxuXHRhc3luYyBjb3B5QXNCYXNlNjQoZmlsZTogVEZpbGUpIHtcblx0XHR0cnkge1xuXHRcdFx0bGV0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXG5cdFx0XHQvLyBcdTZERkJcdTUyQTBcdTUyNERcdTdGMDBcdTUxODVcdTVCQjlcblx0XHRcdGNvbnN0IHByZWZpeCA9IGF3YWl0IHRoaXMucmVhZFRlbXBsYXRlRmlsZSh0aGlzLnNldHRpbmdzLnByZWZpeEZpbGVQYXRoKTtcblx0XHRcdGlmIChwcmVmaXgpIHtcblx0XHRcdFx0Y29udGVudCA9IHByZWZpeCArICdcXG5cXG4nICsgY29udGVudDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gXHU2REZCXHU1MkEwXHU1NDBFXHU3RjAwXHU1MTg1XHU1QkI5XG5cdFx0XHRjb25zdCBzdWZmaXggPSBhd2FpdCB0aGlzLnJlYWRUZW1wbGF0ZUZpbGUodGhpcy5zZXR0aW5ncy5zdWZmaXhGaWxlUGF0aCk7XG5cdFx0XHRpZiAoc3VmZml4KSB7XG5cdFx0XHRcdGNvbnRlbnQgPSBjb250ZW50ICsgJ1xcblxcbicgKyBzdWZmaXg7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY29udmVydE1hcmtkb3duVG9CYXNlNjQoY29udGVudCwgZmlsZSk7XG5cblx0XHRcdC8vIFx1NTkwRFx1NTIzNlx1NTIzMFx1NTI2QVx1OEQzNFx1Njc3RlxuXHRcdFx0YXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQocmVzdWx0LmNvbnRlbnQpO1xuXG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHQvLyBcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTc2ODRcdTU5MDRcdTc0MDZcdTdFRDNcdTY3OUNcblx0XHRcdFx0dGhpcy5zaG93RGV0YWlsZWRSZXN1bHRzKHJlc3VsdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdcdTI3MDUgQ29waWVkIGFzIEJhc2U2NCBmb3JtYXQnKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bmV3IE5vdGljZSgnXHUyNzRDIEZhaWxlZCB0byBjb3B5OiAnICsgZXJyb3IubWVzc2FnZSk7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdDb3B5IGZhaWxlZDonLCBlcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTU5MDRcdTc0MDZcdTdFRDNcdTY3OUMgPT09PT09PT09PVxuXHRzaG93RGV0YWlsZWRSZXN1bHRzKHJlc3VsdDoge2NvbnRlbnQ6IHN0cmluZywgY29udmVydGVkQ291bnQ6IG51bWJlciwgc2tpcHBlZENvdW50OiBudW1iZXIsIGRldGFpbHM6IEFycmF5PHtwYXRoOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nLCByZWFzb24/OiBzdHJpbmd9Pn0pIHtcblx0XHRjb25zdCB0b3RhbCA9IHJlc3VsdC5jb252ZXJ0ZWRDb3VudCArIHJlc3VsdC5za2lwcGVkQ291bnQ7XG5cblx0XHQvLyBcdTRFM0JcdTkwMUFcdTc3RTVcblx0XHRsZXQgbWVzc2FnZSA9ICdcdTI3MDUgQ29waWVkIHRvIGNsaXBib2FyZFxcblxcbic7XG5cblx0XHRtZXNzYWdlICs9IGBcdUQ4M0RcdURDQ0EgU3VtbWFyeTogJHt0b3RhbH0gaW1hZ2VzXFxuYDtcblx0XHRtZXNzYWdlICs9IGAgICBcdTIwMjIgQ29udmVydGVkOiAke3Jlc3VsdC5jb252ZXJ0ZWRDb3VudH1cXG5gO1xuXHRcdG1lc3NhZ2UgKz0gYCAgIFx1MjAyMiBTa2lwcGVkOiAke3Jlc3VsdC5za2lwcGVkQ291bnR9YDtcblxuXHRcdC8vIFx1NTk4Mlx1Njc5Q1x1NTQyRlx1NzUyOFx1NEU4Nlx1OEJFNlx1N0VDNlx1NjVFNVx1NUZEN1x1RkYwQ1x1NjYzRVx1NzkzQVx1NkJDRlx1NEUyQVx1NTZGRVx1NzI0N1x1NzY4NFx1NzJCNlx1NjAwMVxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dEZXRhaWxlZExvZykge1xuXHRcdFx0bWVzc2FnZSArPSAnXFxuXFxuJztcblxuXHRcdFx0Ly8gXHU2NjNFXHU3OTNBXHU2QkNGXHU0RTJBXHU1NkZFXHU3MjQ3XHU3Njg0XHU4QkU2XHU3RUM2XHU3MkI2XHU2MDAxXG5cdFx0XHRjb25zdCBtYXhEaXNwbGF5ID0gODsgLy8gXHU2NzAwXHU1OTFBXHU2NjNFXHU3OTNBOFx1NEUyQVx1NTZGRVx1NzI0N1x1NzY4NFx1OEJFNlx1NjBDNVxuXHRcdFx0Y29uc3QgZGV0YWlsc1RvU2hvdyA9IHJlc3VsdC5kZXRhaWxzLnNsaWNlKDAsIG1heERpc3BsYXkpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGRldGFpbCBvZiBkZXRhaWxzVG9TaG93KSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVOYW1lID0gZGV0YWlsLnBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCBkZXRhaWwucGF0aDtcblx0XHRcdFx0Y29uc3Qgc2hvcnROYW1lID0gZmlsZU5hbWUubGVuZ3RoID4gMzUgPyBmaWxlTmFtZS5zdWJzdHJpbmcoMCwgMzIpICsgJy4uLicgOiBmaWxlTmFtZTtcblxuXHRcdFx0XHRpZiAoZGV0YWlsLnN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSArPSBgXHUyNzEzICR7c2hvcnROYW1lfVxcbmA7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZGV0YWlsLnN0YXR1cyA9PT0gJ2ZhaWxlZCcpIHtcblx0XHRcdFx0XHRtZXNzYWdlICs9IGBcdTI3MTcgJHtzaG9ydE5hbWV9XFxuICBcdTIxOTIgJHtkZXRhaWwucmVhc29ufVxcbmA7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZGV0YWlsLnN0YXR1cyA9PT0gJ3NraXBwZWQnKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSArPSBgXHUyMjk4ICR7c2hvcnROYW1lfVxcbiAgXHUyMTkyICR7ZGV0YWlsLnJlYXNvbn1cXG5gO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFx1NTk4Mlx1Njc5Q1x1OEZEOFx1NjcwOVx1NjZGNFx1NTkxQVx1NTZGRVx1NzI0N1x1NjcyQVx1NjYzRVx1NzkzQVxuXHRcdFx0aWYgKHJlc3VsdC5kZXRhaWxzLmxlbmd0aCA+IG1heERpc3BsYXkpIHtcblx0XHRcdFx0Y29uc3QgcmVtYWluaW5nID0gcmVzdWx0LmRldGFpbHMubGVuZ3RoIC0gbWF4RGlzcGxheTtcblx0XHRcdFx0bWVzc2FnZSArPSBgXFxuLi4uIGFuZCAke3JlbWFpbmluZ30gbW9yZWA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gXHU2NjNFXHU3OTNBXHU2M0E3XHU1MjM2XHU1M0YwXHU2M0QwXHU3OTNBXG5cdFx0bWVzc2FnZSArPSBgXFxuXFxuXHVEODNEXHVEQ0ExIENvbnNvbGUgKEN0cmwrU2hpZnQrSSkgZm9yIGZ1bGwgZGV0YWlsc2A7XG5cblx0XHQvLyBcdTY2M0VcdTc5M0FcdTY1RjZcdTk1RjRcdTY2RjRcdTk1N0ZcdTc2ODRcdTkwMUFcdTc3RTVcdUZGMDg4XHU3OUQyXHVGRjA5XG5cdFx0bmV3IE5vdGljZShtZXNzYWdlLCA4MDAwKTtcblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU2ODM4XHU1RkMzXHU4RjZDXHU2MzYyXHU5MDNCXHU4RjkxID09PT09PT09PT1cblx0YXN5bmMgY29udmVydE1hcmtkb3duVG9CYXNlNjQoY29udGVudDogc3RyaW5nLCBzb3VyY2VGaWxlOiBURmlsZSk6IFByb21pc2U8e2NvbnRlbnQ6IHN0cmluZywgY29udmVydGVkQ291bnQ6IG51bWJlciwgc2tpcHBlZENvdW50OiBudW1iZXIsIGRldGFpbHM6IEFycmF5PHtwYXRoOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nLCByZWFzb24/OiBzdHJpbmd9Pn0+IHtcblx0XHQvLyBcdTUzMzlcdTkxNEQgTWFya2Rvd24gXHU1NkZFXHU3MjQ3XHU4QkVEXHU2Q0Q1OiAhW2FsdF0ocGF0aCkgXHU2MjE2ICFbYWx0XSg8cGF0aD4pXG5cdFx0Ly8gXHU2NTJGXHU2MzAxIE9ic2lkaWFuIFx1NzY4NCAhW1tpbWFnZS5wbmddXSBcdThCRURcdTZDRDVcblx0XHRjb25zdCBpbWdSZWdleCA9IC8hXFxbKFteXFxdXSopXFxdXFwoPD8oW14pXCI+XSspPj9cXCl8IVxcW1xcWyhbXlxcXV0rXFwuKHBuZ3xqcGd8anBlZ3xnaWZ8d2VicHxzdmd8Ym1wKSlcXF1cXF0vZ2k7XG5cblx0XHRsZXQgcmVzdWx0ID0gY29udGVudDtcblx0XHRsZXQgY29udmVydGVkQ291bnQgPSAwO1xuXHRcdGxldCBza2lwcGVkQ291bnQgPSAwO1xuXHRcdGNvbnN0IGRldGFpbHM6IEFycmF5PHtwYXRoOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nLCByZWFzb24/OiBzdHJpbmd9PiA9IFtdO1xuXG5cdFx0Y29uc3QgbWF0Y2hlcyA9IFsuLi5jb250ZW50Lm1hdGNoQWxsKGltZ1JlZ2V4KV07XG5cblx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0Y29uc29sZS5sb2coYFtNREltYWdlRW1iZWRdIFx1NUYwMFx1NTlDQlx1NTkwNFx1NzQwNlx1NjU4N1x1Njg2M1x1RkYwQ1x1NTE3MVx1NjI3RVx1NTIzMCAke21hdGNoZXMubGVuZ3RofSBcdTRFMkFcdTU2RkVcdTcyNDdgKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMpIHtcblx0XHRcdGNvbnN0IGZ1bGxNYXRjaCA9IG1hdGNoWzBdO1xuXG5cdFx0XHQvLyBcdTU5MDRcdTc0MDZcdTY4MDdcdTUxQzYgTWFya2Rvd24gXHU4QkVEXHU2Q0Q1OiAhW2FsdF0ocGF0aClcblx0XHRcdGlmIChtYXRjaFsxXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGFsdFRleHQgPSBtYXRjaFsxXTtcblx0XHRcdFx0Y29uc3QgaW1hZ2VQYXRoID0gbWF0Y2hbMl07XG5cblx0XHRcdFx0Ly8gXHU4REYzXHU4RkM3XHU1REYyXHU3RUNGXHU2NjJGIGJhc2U2NCBcdTc2ODRcdTU2RkVcdTcyNDdcblx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2tpcEJhc2U2NEltYWdlcyAmJiBpbWFnZVBhdGguc3RhcnRzV2l0aCgnZGF0YTppbWFnZScpKSB7XG5cdFx0XHRcdFx0c2tpcHBlZENvdW50Kys7XG5cdFx0XHRcdFx0Y29uc3QgZGlzcGxheVBhdGggPSBpbWFnZVBhdGguc3Vic3RyaW5nKDAsIDMwKSArICcuLi4nO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogZGlzcGxheVBhdGgsIHN0YXR1czogJ3NraXBwZWQnLCByZWFzb246ICdBbHJlYWR5IEJhc2U2NCd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdThERjNcdThGQzddICR7ZGlzcGxheVBhdGh9IC0gXHU1MzlGXHU1NkUwOiBcdTVERjJcdTY2MkYgQmFzZTY0IFx1NjgzQ1x1NUYwRmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFx1OERGM1x1OEZDN1x1N0Y1MVx1N0VEQ1x1NTZGRVx1NzI0N1x1RkYwOFx1NEUwRFx1NjUyRlx1NjMwMVx1RkYwOVxuXHRcdFx0XHRpZiAoaW1hZ2VQYXRoLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCBpbWFnZVBhdGguc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuXHRcdFx0XHRcdHNraXBwZWRDb3VudCsrO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogaW1hZ2VQYXRoLCBzdGF0dXM6ICdza2lwcGVkJywgcmVhc29uOiAnTmV0d29yayBpbWFnZSAobm90IHN1cHBvcnRlZCknfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU4REYzXHU4RkM3XSAke2ltYWdlUGF0aH0gLSBcdTUzOUZcdTU2RTA6IFx1N0Y1MVx1N0VEQ1x1NTZGRVx1NzI0N1x1NEUwRFx1NjUyRlx1NjMwMVx1OEY2Q1x1NjM2MmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFx1OEY2Q1x1NjM2Mlx1NjcyQ1x1NTczMFx1NTZGRVx1NzI0N1xuXHRcdFx0XHRjb25zdCBiYXNlNjQgPSBhd2FpdCB0aGlzLmltYWdlVG9CYXNlNjQoaW1hZ2VQYXRoLCBzb3VyY2VGaWxlKTtcblx0XHRcdFx0aWYgKGJhc2U2NCkge1xuXHRcdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKGZ1bGxNYXRjaCwgYCFbJHthbHRUZXh0fV0oJHtiYXNlNjR9KWApO1xuXHRcdFx0XHRcdGNvbnZlcnRlZENvdW50Kys7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBpbWFnZVBhdGgsIHN0YXR1czogJ3N1Y2Nlc3MnfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU2MjEwXHU1MjlGXSAke2ltYWdlUGF0aH0gLSBcdTVERjJcdThGNkNcdTYzNjJcdTRFM0EgQmFzZTY0YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNraXBwZWRDb3VudCsrO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogaW1hZ2VQYXRoLCBzdGF0dXM6ICdmYWlsZWQnLCByZWFzb246ICdGaWxlIG5vdCBmb3VuZCd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdTU5MzFcdThEMjVdICR7aW1hZ2VQYXRofSAtIFx1NTM5Rlx1NTZFMDogXHU2NTg3XHU0RUY2XHU2NzJBXHU2MjdFXHU1MjMwXHU2MjE2XHU4QkZCXHU1M0Q2XHU1OTMxXHU4RDI1YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBcdTU5MDRcdTc0MDYgT2JzaWRpYW4gV2lraSBcdThCRURcdTZDRDU6ICFbW2ltYWdlLnBuZ11dXG5cdFx0XHRlbHNlIGlmIChtYXRjaFszXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGltYWdlTmFtZSA9IG1hdGNoWzNdO1xuXHRcdFx0XHRjb25zdCBkaXNwbGF5UGF0aCA9IGAhW1ske2ltYWdlTmFtZX1dXWA7XG5cblx0XHRcdFx0Ly8gXHU1OTgyXHU2NzlDXHU0RTBEXHU4RjZDXHU2MzYyIFdpa2kgXHU5NEZFXHU2M0E1XHVGRjBDXHU4REYzXHU4RkM3XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5jb252ZXJ0V2lraUxpbmtzKSB7XG5cdFx0XHRcdFx0c2tpcHBlZENvdW50Kys7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBkaXNwbGF5UGF0aCwgc3RhdHVzOiAnc2tpcHBlZCcsIHJlYXNvbjogJ1dpa2kgbGluayBjb252ZXJzaW9uIGRpc2FibGVkJ30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1OERGM1x1OEZDN10gJHtkaXNwbGF5UGF0aH0gLSBcdTUzOUZcdTU2RTA6IFdpa2kgXHU5NEZFXHU2M0E1XHU4RjZDXHU2MzYyXHU1REYyXHU3OTgxXHU3NTI4YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gXHU4RjZDXHU2MzYyXHU0RTNBIGJhc2U2NFxuXHRcdFx0XHRjb25zdCBiYXNlNjQgPSBhd2FpdCB0aGlzLmltYWdlVG9CYXNlNjQoaW1hZ2VOYW1lLCBzb3VyY2VGaWxlKTtcblx0XHRcdFx0aWYgKGJhc2U2NCkge1xuXHRcdFx0XHRcdC8vIFx1OEY2Q1x1NjM2Mlx1NEUzQVx1NjgwN1x1NTFDNiBNYXJrZG93biBcdThCRURcdTZDRDVcblx0XHRcdFx0XHRyZXN1bHQgPSByZXN1bHQucmVwbGFjZShmdWxsTWF0Y2gsIGAhWyR7aW1hZ2VOYW1lfV0oJHtiYXNlNjR9KWApO1xuXHRcdFx0XHRcdGNvbnZlcnRlZENvdW50Kys7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBkaXNwbGF5UGF0aCwgc3RhdHVzOiAnc3VjY2Vzcyd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdTYyMTBcdTUyOUZdICR7ZGlzcGxheVBhdGh9IC0gXHU1REYyXHU4RjZDXHU2MzYyXHU0RTNBIEJhc2U2NGApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRza2lwcGVkQ291bnQrKztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGRpc3BsYXlQYXRoLCBzdGF0dXM6ICdmYWlsZWQnLCByZWFzb246ICdGaWxlIG5vdCBmb3VuZCd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdTU5MzFcdThEMjVdICR7ZGlzcGxheVBhdGh9IC0gXHU1MzlGXHU1NkUwOiBcdTY1ODdcdTRFRjZcdTY3MkFcdTYyN0VcdTUyMzBcdTYyMTZcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0Y29uc29sZS5sb2coYFtNREltYWdlRW1iZWRdIFx1NTkwNFx1NzQwNlx1NUI4Q1x1NjIxMDogJHtjb252ZXJ0ZWRDb3VudH0gXHU0RTJBXHU2MjEwXHU1MjlGLCAke3NraXBwZWRDb3VudH0gXHU0RTJBXHU4REYzXHU4RkM3YCk7XG5cdFx0fVxuXHRcdHJldHVybiB7IGNvbnRlbnQ6IHJlc3VsdCwgY29udmVydGVkQ291bnQsIHNraXBwZWRDb3VudCwgZGV0YWlscyB9O1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdTU2RkVcdTcyNDdcdThGNkMgQmFzZTY0ID09PT09PT09PT1cblx0YXN5bmMgaW1hZ2VUb0Jhc2U2NChpbWFnZVBhdGg6IHN0cmluZywgc291cmNlRmlsZTogVEZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHR0cnkge1xuXHRcdFx0Ly8gXHU4OUUzXHU2NzkwXHU1NkZFXHU3MjQ3XHU4REVGXHU1Rjg0XG5cdFx0XHRjb25zdCBpbWFnZUZpbGUgPSB0aGlzLnJlc29sdmVJbWFnZVBhdGgoaW1hZ2VQYXRoLCBzb3VyY2VGaWxlKTtcblx0XHRcdGlmICghaW1hZ2VGaWxlKSB7XG5cdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKGAgIFx1MjUxNFx1MjUwMCBcdThERUZcdTVGODRcdTg5RTNcdTY3OTBcdTU5MzFcdThEMjU6IFx1NTcyOFx1NEVFNVx1NEUwQlx1NEY0RFx1N0Y2RVx1OTBGRFx1NjcyQVx1NjI3RVx1NTIzMFx1NjU4N1x1NEVGNmApO1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgICAgICAtIFZhdWx0IFx1NjgzOVx1NzZFRVx1NUY1NTogJHtpbWFnZVBhdGh9YCk7XG5cdFx0XHRcdFx0aWYgKHNvdXJjZUZpbGUucGFyZW50KSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oYCAgICAgLSBcdTc2RjhcdTVCRjlcdThERUZcdTVGODQ6ICR7c291cmNlRmlsZS5wYXJlbnQucGF0aH0vJHtpbWFnZVBhdGh9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgICBcdTI1MTRcdTI1MDAgXHU2NTg3XHU0RUY2XHU1REYyXHU2MjdFXHU1MjMwOiAke2ltYWdlRmlsZS5wYXRofWApO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBcdThCRkJcdTUzRDZcdTU2RkVcdTcyNDdcdTRFM0EgQXJyYXlCdWZmZXJcblx0XHRcdGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZEJpbmFyeShpbWFnZUZpbGUpO1xuXG5cdFx0XHQvLyBcdThGNkNcdTYzNjJcdTRFM0EgQmFzZTY0XG5cdFx0XHRjb25zdCBiYXNlNjQgPSB0aGlzLmFycmF5QnVmZmVyVG9CYXNlNjQoYXJyYXlCdWZmZXIpO1xuXG5cdFx0XHQvLyBcdTgzQjdcdTUzRDYgTUlNRSBcdTdDN0JcdTU3OEJcblx0XHRcdGNvbnN0IG1pbWVUeXBlID0gdGhpcy5nZXRNaW1lVHlwZShpbWFnZUZpbGUuZXh0ZW5zaW9uKTtcblxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc3Qgc2l6ZUtCID0gKGFycmF5QnVmZmVyLmJ5dGVMZW5ndGggLyAxMDI0KS50b0ZpeGVkKDIpO1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgICBcdTI1MTRcdTI1MDAgXHU2NTg3XHU0RUY2XHU1OTI3XHU1QzBGOiAke3NpemVLQn0gS0IsIE1JTUU6ICR7bWltZVR5cGV9YCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBgZGF0YToke21pbWVUeXBlfTtiYXNlNjQsJHtiYXNlNjR9YDtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgICBcdTI1MTRcdTI1MDAgXHU4QkZCXHU1M0Q2XHU2MjE2XHU4RjZDXHU2MzYyXHU1OTMxXHU4RDI1OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1OERFRlx1NUY4NFx1ODlFM1x1Njc5MCA9PT09PT09PT09XG5cdHJlc29sdmVJbWFnZVBhdGgoaW1hZ2VQYXRoOiBzdHJpbmcsIHNvdXJjZUZpbGU6IFRGaWxlKTogVEZpbGUgfCBudWxsIHtcblx0XHQvLyBcdTc5RkJcdTk2NjQgT2JzaWRpYW4gXHU4REVGXHU1Rjg0XHU1MjREXHU3RjAwXG5cdFx0bGV0IGNsZWFuUGF0aCA9IGltYWdlUGF0aC5yZXBsYWNlKC9ePHw+JC9nLCAnJykudHJpbSgpO1xuXG5cdFx0Ly8gVVJMIFx1ODlFM1x1NzgwMVx1RkYwOFx1NTkwNFx1NzQwNiAlMjAgXHU3QjQ5XHU3RjE2XHU3ODAxXHU1QjU3XHU3QjI2XHVGRjA5XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRlY29kZWQgPSBkZWNvZGVVUklDb21wb25lbnQoY2xlYW5QYXRoKTtcblx0XHRcdGlmIChkZWNvZGVkICE9PSBjbGVhblBhdGgpIHtcblx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgICBcdTI1MTRcdTI1MDAgVVJMIFx1ODlFM1x1NzgwMTogXCIke2NsZWFuUGF0aH1cIiBcdTIxOTIgXCIke2RlY29kZWR9XCJgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2xlYW5QYXRoID0gZGVjb2RlZDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHQvLyBcdTU5ODJcdTY3OUNcdTg5RTNcdTc4MDFcdTU5MzFcdThEMjVcdUZGMENcdTRGN0ZcdTc1MjhcdTUzOUZcdThERUZcdTVGODRcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgICBcdTI1MTRcdTI1MDAgVVJMIFx1ODlFM1x1NzgwMVx1NTkzMVx1OEQyNVx1RkYwQ1x1NEY3Rlx1NzUyOFx1NTM5Rlx1OERFRlx1NUY4NDogJHtjbGVhblBhdGh9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gXHU2NUI5XHU2Q0Q1IDE6IFx1NzZGNFx1NjNBNVx1NEVDRSBWYXVsdCBcdTY4MzlcdTc2RUVcdTVGNTVcdTY3RTVcdTYyN0Vcblx0XHRsZXQgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjbGVhblBhdGgpO1xuXHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGAgIFx1MjUxNFx1MjUwMCBcdTg5RTNcdTY3OTBcdTY1QjlcdTZDRDU6IFZhdWx0IFx1NjgzOVx1NzZFRVx1NUY1NWApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZpbGU7XG5cdFx0fVxuXG5cdFx0Ly8gXHU2NUI5XHU2Q0Q1IDI6IFx1NzZGOFx1NUJGOVx1NEU4RVx1NUY1M1x1NTI0RFx1NjU4N1x1NEVGNlx1NjdFNVx1NjI3RVxuXHRcdGlmIChzb3VyY2VGaWxlLnBhcmVudCkge1xuXHRcdFx0Y29uc3QgcmVsYXRpdmVQYXRoID0gYCR7c291cmNlRmlsZS5wYXJlbnQucGF0aH0vJHtjbGVhblBhdGh9YDtcblx0XHRcdGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocmVsYXRpdmVQYXRoKTtcblx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgICBcdTI1MTRcdTI1MDAgXHU4OUUzXHU2NzkwXHU2NUI5XHU2Q0Q1OiBcdTc2RjhcdTVCRjlcdThERUZcdTVGODQgKCR7c291cmNlRmlsZS5wYXJlbnQucGF0aH0vKWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmaWxlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFx1NjVCOVx1NkNENSAzOiBcdTRGN0ZcdTc1MjggT2JzaWRpYW4gXHU3Njg0XHU5NEZFXHU2M0E1XHU4OUUzXHU2NzkwXG5cdFx0Y29uc3QgcmVzb2x2ZWRGaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChjbGVhblBhdGgsIHNvdXJjZUZpbGUucGF0aCk7XG5cdFx0aWYgKHJlc29sdmVkRmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgICBcdTI1MTRcdTI1MDAgXHU4OUUzXHU2NzkwXHU2NUI5XHU2Q0Q1OiBPYnNpZGlhbiBcdTk0RkVcdTYzQTVcdTg5RTNcdTY3OTBgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXNvbHZlZEZpbGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IEFycmF5QnVmZmVyIFx1OEY2QyBCYXNlNjQgPT09PT09PT09PVxuXHRhcnJheUJ1ZmZlclRvQmFzZTY0KGJ1ZmZlcjogQXJyYXlCdWZmZXIpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcblx0XHRsZXQgYmluYXJ5ID0gJyc7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0YmluYXJ5ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0pO1xuXHRcdH1cblx0XHRyZXR1cm4gYnRvYShiaW5hcnkpO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdTgzQjdcdTUzRDYgTUlNRSBcdTdDN0JcdTU3OEIgPT09PT09PT09PVxuXHRnZXRNaW1lVHlwZShleHRlbnNpb246IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbWltZVR5cGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHRcdFx0J3BuZyc6ICdpbWFnZS9wbmcnLFxuXHRcdFx0J2pwZyc6ICdpbWFnZS9qcGVnJyxcblx0XHRcdCdqcGVnJzogJ2ltYWdlL2pwZWcnLFxuXHRcdFx0J2dpZic6ICdpbWFnZS9naWYnLFxuXHRcdFx0J3dlYnAnOiAnaW1hZ2Uvd2VicCcsXG5cdFx0XHQnc3ZnJzogJ2ltYWdlL3N2Zyt4bWwnLFxuXHRcdFx0J2JtcCc6ICdpbWFnZS9ibXAnXG5cdFx0fTtcblx0XHRyZXR1cm4gbWltZVR5cGVzW2V4dGVuc2lvbi50b0xvd2VyQ2FzZSgpXSB8fCAnaW1hZ2UvcG5nJztcblx0fVxufVxuXG4vLyA9PT09PT09PT09IFx1OEJCRVx1N0Y2RVx1OTc2Mlx1Njc3RiA9PT09PT09PT09XG5jbGFzcyBNREltYWdlRW1iZWRTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogTURJbWFnZUVtYmVkUGx1Z2luO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1ESW1hZ2VFbWJlZFBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnTUQgSW1hZ2UgRW1iZWQgU2V0dGluZ3MnIH0pO1xuXG5cdFx0Ly8gXHU4QkJFXHU3RjZFIDE6IFx1NjYzRVx1NzkzQVx1OEY2Q1x1NjM2Mlx1NjVFNVx1NUZEN1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ1Nob3cgY29udmVyc2lvbiBsb2cnKVxuXHRcdFx0LnNldERlc2MoJ0Rpc3BsYXkgc3VtbWFyeSBpbmZvcm1hdGlvbiBpbiBub3RpZmljYXRpb25zJylcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZyA9IHZhbHVlO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdC8vIFx1OTFDRFx1NjVCMFx1NkUzMlx1NjdEM1x1OEJCRVx1N0Y2RVx1OTc2Mlx1Njc3Rlx1NEVFNVx1NjZGNFx1NjVCMFx1OEJFNlx1N0VDNlx1NjVFNVx1NUZEN1x1OTAwOVx1OTg3OVx1NzY4NFx1NTNFRlx1ODlDMVx1NjAyN1xuXHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHQvLyBcdThCQkVcdTdGNkUgMS41OiBcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdUZGMDhcdTRGOURcdThENTZcdTRFOEUgc2hvd0NvbnZlcnNpb25Mb2dcdUZGMDlcblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZSgnU2hvdyBkZXRhaWxlZCBsb2cnKVxuXHRcdFx0XHQuc2V0RGVzYygnU2hvdyBpbmRpdmlkdWFsIGltYWdlIHN0YXR1cyBpbiBub3RpZmljYXRpb25zIChyZXF1aXJlcyBcIlNob3cgY29udmVyc2lvbiBsb2dcIiknKVxuXHRcdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0RldGFpbGVkTG9nKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dEZXRhaWxlZExvZyA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIFx1OEJCRVx1N0Y2RSAyOiBcdThGNkNcdTYzNjIgV2lraSBcdTk0RkVcdTYzQTVcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdDb252ZXJ0IFdpa2kgbGlua3MnKVxuXHRcdFx0LnNldERlc2MoJ0NvbnZlcnQgT2JzaWRpYW4gV2lraSBsaW5rcyAoIVtbaW1hZ2UucG5nXV0pIHRvIHN0YW5kYXJkIE1hcmtkb3duIHdpdGggQmFzZTY0Jylcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udmVydFdpa2lMaW5rcylcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnZlcnRXaWtpTGlua3MgPSB2YWx1ZTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0Ly8gXHU4QkJFXHU3RjZFIDM6IFx1OERGM1x1OEZDNyBCYXNlNjQgXHU1NkZFXHU3MjQ3XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnU2tpcCBCYXNlNjQgaW1hZ2VzJylcblx0XHRcdC5zZXREZXNjKCdTa2lwIGltYWdlcyB0aGF0IGFyZSBhbHJlYWR5IGluIEJhc2U2NCBmb3JtYXQnKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwQmFzZTY0SW1hZ2VzKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc2tpcEJhc2U2NEltYWdlcyA9IHZhbHVlO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHQvLyBcdTUyMDZcdTk2OTRcdTdFQkZcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdBbnRpLXJlcHJpbnQgUHJvdGVjdGlvbicgfSk7XG5cblx0XHQvLyBcdThCQkVcdTdGNkUgNDogXHU1MjREXHU3RjAwXHU2NTg3XHU0RUY2XHU4REVGXHU1Rjg0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnUHJlZml4IGZpbGUgcGF0aCcpXG5cdFx0XHQuc2V0RGVzYygnUGF0aCB0byBtYXJrZG93biBmaWxlIHRvIHByZXBlbmQgKGUuZy4sIFwidGVtcGxhdGVzL3ByZWZpeC5tZFwiKS4gTGVhdmUgZW1wdHkgdG8gZGlzYWJsZS4nKVxuXHRcdFx0LmFkZFRleHQodGV4dCA9PiB0ZXh0XG5cdFx0XHRcdC5zZXRQbGFjZWhvbGRlcigndGVtcGxhdGVzL3ByZWZpeC5tZCcpXG5cdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcmVmaXhGaWxlUGF0aClcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnByZWZpeEZpbGVQYXRoID0gdmFsdWUudHJpbSgpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHQvLyBcdThCQkVcdTdGNkUgNTogXHU1NDBFXHU3RjAwXHU2NTg3XHU0RUY2XHU4REVGXHU1Rjg0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnU3VmZml4IGZpbGUgcGF0aCcpXG5cdFx0XHQuc2V0RGVzYygnUGF0aCB0byBtYXJrZG93biBmaWxlIHRvIGFwcGVuZCAoZS5nLiwgXCJ0ZW1wbGF0ZXMvc3VmZml4Lm1kXCIpLiBMZWF2ZSBlbXB0eSB0byBkaXNhYmxlLicpXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHRleHRcblx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCd0ZW1wbGF0ZXMvc3VmZml4Lm1kJylcblx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnN1ZmZpeEZpbGVQYXRoKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc3VmZml4RmlsZVBhdGggPSB2YWx1ZS50cmltKCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQU9BLHNCQUE0RTtBQVk1RSxJQUFNLG1CQUF5QztBQUFBLEVBQzlDLG1CQUFtQjtBQUFBLEVBQ25CLGlCQUFpQjtBQUFBLEVBQ2pCLGtCQUFrQjtBQUFBLEVBQ2xCLGtCQUFrQjtBQUFBLEVBQ2xCLGdCQUFnQjtBQUFBLEVBQ2hCLGdCQUFnQjtBQUNqQjtBQUdBLElBQXFCLHFCQUFyQixjQUFnRCx1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
