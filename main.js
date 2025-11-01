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
  showConversionLog: true,
  fileSuffix: "_base64",
  convertWikiLinks: true,
  skipBase64Images: true
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
    menu.addItem((item) => {
      item.setTitle("Save as Base64 format").setIcon("save").onClick(async () => {
        await this.saveAsBase64(file);
      });
    });
  }
  // ========== 功能 1: 复制到剪贴板 ==========
  async copyAsBase64(file) {
    try {
      const content = await this.app.vault.read(file);
      const result = await this.convertMarkdownToBase64(content, file);
      await navigator.clipboard.writeText(result.content);
      if (this.settings.showConversionLog) {
        new import_obsidian.Notice(`\u2705 Copied! ${result.convertedCount} images converted, ${result.skippedCount} skipped`);
      } else {
        new import_obsidian.Notice("\u2705 Copied as Base64 format");
      }
    } catch (error) {
      new import_obsidian.Notice("\u274C Failed to copy: " + error.message);
      console.error("Copy failed:", error);
    }
  }
  // ========== 功能 2: 另存为新文件 ==========
  async saveAsBase64(file) {
    try {
      const content = await this.app.vault.read(file);
      const result = await this.convertMarkdownToBase64(content, file);
      const baseName = file.basename;
      const newFileName = `${baseName}${this.settings.fileSuffix}.md`;
      const newFilePath = file.parent ? `${file.parent.path}/${newFileName}` : newFileName;
      await this.app.vault.create(newFilePath, result.content);
      if (this.settings.showConversionLog) {
        new import_obsidian.Notice(`\u2705 Saved as ${newFileName}! ${result.convertedCount} images converted`);
      } else {
        new import_obsidian.Notice(`\u2705 Saved as ${newFileName}`);
      }
    } catch (error) {
      new import_obsidian.Notice("\u274C Failed to save: " + error.message);
      console.error("Save failed:", error);
    }
  }
  // ========== 核心转换逻辑 ==========
  async convertMarkdownToBase64(content, sourceFile) {
    const imgRegex = /!\[([^\]]*)\]\(<?([^)">]+)>?\)|!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]/gi;
    let result = content;
    let convertedCount = 0;
    let skippedCount = 0;
    const matches = [...content.matchAll(imgRegex)];
    for (const match of matches) {
      const fullMatch = match[0];
      if (match[1] !== void 0) {
        const altText = match[1];
        const imagePath = match[2];
        if (this.settings.skipBase64Images && imagePath.startsWith("data:image")) {
          skippedCount++;
          continue;
        }
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
          skippedCount++;
          continue;
        }
        const base64 = await this.imageToBase64(imagePath, sourceFile);
        if (base64) {
          result = result.replace(fullMatch, `![${altText}](${base64})`);
          convertedCount++;
        } else {
          skippedCount++;
        }
      } else if (match[3] !== void 0) {
        const imageName = match[3];
        if (!this.settings.convertWikiLinks) {
          skippedCount++;
          continue;
        }
        const base64 = await this.imageToBase64(imageName, sourceFile);
        if (base64) {
          result = result.replace(fullMatch, `![${imageName}](${base64})`);
          convertedCount++;
        } else {
          skippedCount++;
        }
      }
    }
    console.log(`\u8F6C\u6362\u5B8C\u6210: ${convertedCount} \u4E2A\u56FE\u7247\u5DF2\u8F6C\u6362, ${skippedCount} \u4E2A\u5DF2\u8DF3\u8FC7`);
    return { content: result, convertedCount, skippedCount };
  }
  // ========== 图片转 Base64 ==========
  async imageToBase64(imagePath, sourceFile) {
    try {
      const imageFile = this.resolveImagePath(imagePath, sourceFile);
      if (!imageFile) {
        console.warn(`\u627E\u4E0D\u5230\u56FE\u7247: ${imagePath}`);
        return null;
      }
      const arrayBuffer = await this.app.vault.readBinary(imageFile);
      const base64 = this.arrayBufferToBase64(arrayBuffer);
      const mimeType = this.getMimeType(imageFile.extension);
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error(`\u8F6C\u6362\u56FE\u7247\u5931\u8D25: ${imagePath}`, error);
      return null;
    }
  }
  // ========== 路径解析 ==========
  resolveImagePath(imagePath, sourceFile) {
    let cleanPath = imagePath.replace(/^<|>$/g, "").trim();
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch (e) {
      console.warn(`URL decode failed for path: ${cleanPath}`, e);
    }
    let file = this.app.vault.getAbstractFileByPath(cleanPath);
    if (file instanceof import_obsidian.TFile) {
      return file;
    }
    if (sourceFile.parent) {
      const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
      file = this.app.vault.getAbstractFileByPath(relativePath);
      if (file instanceof import_obsidian.TFile) {
        return file;
      }
    }
    const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
    if (resolvedFile instanceof import_obsidian.TFile) {
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
    new import_obsidian.Setting(containerEl).setName("Show conversion log").setDesc("Display detailed information about converted and skipped images").addToggle((toggle) => toggle.setValue(this.plugin.settings.showConversionLog).onChange(async (value) => {
      this.plugin.settings.showConversionLog = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("File suffix").setDesc('Suffix for "Save as" files (e.g., "_base64" \u2192 filename_base64.md)').addText((text) => text.setPlaceholder("_base64").setValue(this.plugin.settings.fileSuffix).onChange(async (value) => {
      this.plugin.settings.fileSuffix = value || "_base64";
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Convert Wiki links").setDesc("Convert Obsidian Wiki links (![[image.png]]) to standard Markdown with Base64").addToggle((toggle) => toggle.setValue(this.plugin.settings.convertWikiLinks).onChange(async (value) => {
      this.plugin.settings.convertWikiLinks = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Skip Base64 images").setDesc("Skip images that are already in Base64 format").addToggle((toggle) => toggle.setValue(this.plugin.settings.skipBase64Images).onChange(async (value) => {
      this.plugin.settings.skipBase64Images = value;
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
