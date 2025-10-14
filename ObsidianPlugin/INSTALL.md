# 安装指南

## 快速安装

### 步骤 1: 安装依赖

```bash
cd ObsidianPlugin
npm install
```

### 步骤 2: 构建插件

```bash
# 开发模式（自动监听文件变化）
npm run dev

# 生产构建
npm run build
```

### 步骤 3: 复制到 Obsidian

构建完成后，会生成 `main.js` 文件。将以下文件复制到你的 Obsidian Vault：

```
.obsidian/plugins/md-image-embed/
├── main.js          # 构建生成
├── manifest.json    # 插件配置
└── styles.css       # (可选) 样式文件
```

**完整路径示例**：
```
D:/GitHub/mengzhishanghun/MyObsidian/.obsidian/plugins/md-image-embed/
```

### 步骤 4: 启用插件

1. 重启 Obsidian
2. 打开 **设置 → 社区插件**
3. 在已安装插件列表中找到 **MD Image Embed**
4. 点击启用

## 开发模式

如果你想边开发边测试：

```bash
# 在插件目录运行
npm run dev
```

然后在 Obsidian 中：
- 按 `Ctrl + R` (Windows) 或 `Cmd + R` (macOS) 重载插件
- 或通过命令面板执行 "Reload app without saving"

## 使用方法

### 方法 1: 复制到剪贴板

1. 在文件浏览器中右键点击 `.md` 文件
2. 选择 **📋 复制为 Base64 格式**
3. 粘贴到需要的地方

### 方法 2: 另存为新文件

1. 在文件浏览器中右键点击 `.md` 文件
2. 选择 **💾 另存为 Base64 格式**
3. 会生成 `原文件名_base64.md`

## 测试

用你桌面上的测试文件试试：
```
01-Perforce快速上手：安装配置完全指南.md
```

右键该文件 → 选择其中一个操作即可！

## 常见问题

### Q: 找不到图片？
A: 插件会自动尝试以下路径：
1. Vault 根目录
2. 相对于当前文件
3. Obsidian 链接解析

### Q: 文件太大？
A: Base64 会增加约 33% 的体积，建议只在需要导出时使用

### Q: 可以转换网络图片吗？
A: 不可以，插件只转换本地图片。网络图片会自动跳过。
