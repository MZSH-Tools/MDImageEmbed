# MD Image Embed - Obsidian Plugin

将 Markdown 文件中的图片转换为 Base64 内嵌格式，方便导出和分享。

## 功能特性

- 📋 **复制为 Base64 格式**：右键 Markdown 文件，选择"复制为 Base64 格式"，自动将所有图片转换并复制到剪贴板
- 💾 **另存为 Base64 格式**：右键 Markdown 文件，选择"另存为 Base64 格式"，生成新文件（原文件名_base64.md）
- 🎯 **智能路径解析**：自动处理 Obsidian 的各种图片路径格式
- 🔄 **支持多种语法**：
  - 标准 Markdown: `![alt](path)`
  - 尖括号路径: `![alt](<path>)`
  - Obsidian Wiki 链接: `![[image.png]]`
- 🖼️ **支持格式**：PNG, JPG, JPEG, GIF, WebP, SVG, BMP

## 安装方法

### 手动安装

1. 下载 `main.js` 和 `manifest.json`
2. 在 Obsidian Vault 中创建目录：`.obsidian/plugins/md-image-embed/`
3. 将下载的文件放入该目录
4. 重启 Obsidian
5. 在设置 → 社区插件中启用 "MD Image Embed"

### 开发安装

```bash
cd ObsidianPlugin
npm install
npm run dev  # 开发模式
npm run build  # 生产构建
```

## 使用方法

### 方法 1: 复制到剪贴板

1. 在文件浏览器中右键点击 `.md` 文件
2. 选择 **📋 复制为 Base64 格式**
3. 所有图片转换完成后自动复制到剪贴板
4. 粘贴到任何支持 Markdown 的地方（博客、公众号等）

### 方法 2: 另存为新文件

1. 在文件浏览器中右键点击 `.md` 文件
2. 选择 **💾 另存为 Base64 格式**
3. 自动生成新文件：`原文件名_base64.md`
4. 新文件中所有图片已转换为 Base64 格式

## 使用场景

- ✅ 发布博客文章（无需上传图片到图床）
- ✅ 分享笔记给他人（单个文件包含所有内容）
- ✅ 导出到不支持外部图片的平台（如公众号）
- ✅ 归档文档（避免图片链接失效）

## 注意事项

⚠️ **文件大小**：Base64 会增加约 33% 的文件大小，大图片较多的文档可能会很大

⚠️ **自动跳过**：
- 已经是 Base64 格式的图片
- 网络图片（http:// 或 https://）
- 找不到的本地图片

## 技术细节

- 使用 TypeScript 开发
- 兼容 Obsidian API 0.15.0+
- 支持桌面端和移动端
- 自动识别仓库结构中的图片路径

## 项目结构

```
ObsidianPlugin/
├── main.ts              # 插件主文件
├── manifest.json        # 插件配置
├── package.json         # 项目依赖
├── tsconfig.json        # TypeScript 配置
├── esbuild.config.mjs   # 构建配置
└── README.md            # 说明文档
```

## 开发说明

### 核心功能实现

```typescript
// 转换 Markdown 中的图片为 Base64
async ConvertMarkdownToBase64(content: string, sourceFile: TFile): Promise<string>

// 图片文件转 Base64 字符串
async ImageToBase64(imagePath: string, sourceFile: TFile): Promise<string | null>

// 路径解析（支持相对路径、绝对路径、Wiki 链接）
ResolveImagePath(imagePath: string, sourceFile: TFile): TFile | null
```

### 路径解析策略

1. 直接从 Vault 根目录查找
2. 相对于当前文件查找
3. 使用 Obsidian 的链接解析 API

这样可以兼容各种 Obsidian 配置（附件在根目录、子目录等）

## 许可证

MIT License

## 反馈与贡献

欢迎提交 Issue 和 Pull Request！

项目地址：https://github.com/mengzhishanghun/MZSH-Tools
