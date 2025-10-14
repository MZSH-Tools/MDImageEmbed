/**
 * MDImageEmbed - Obsidian Plugin
 * 将 Markdown 图片转换为 Base64 内嵌格式
 */
import { Plugin, TFile, Notice, Menu } from 'obsidian';

export default class MDImageEmbedPlugin extends Plugin {

	// ========== 插件生命周期 ==========
	async onload() {
		console.log('MDImageEmbed 插件已加载');

		// 注册文件菜单事件（右键菜单）
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.AddFileMenuItems(menu, file);
				}
			})
		);
	}

	onunload() {
		console.log('MDImageEmbed 插件已卸载');
	}

	// ========== 右键菜单 ==========
	AddFileMenuItems(menu: Menu, file: TFile) {
		// 菜单项 1: 复制为 Base64 格式到剪贴板
		menu.addItem((item) => {
			item
				.setTitle('📋 复制为 Base64 格式')
				.setIcon('clipboard-copy')
				.onClick(async () => {
					await this.CopyAsBase64(file);
				});
		});

		// 菜单项 2: 另存为 Base64 格式
		menu.addItem((item) => {
			item
				.setTitle('💾 另存为 Base64 格式')
				.setIcon('save')
				.onClick(async () => {
					await this.SaveAsBase64(file);
				});
		});
	}

	// ========== 功能 1: 复制到剪贴板 ==========
	async CopyAsBase64(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const convertedContent = await this.ConvertMarkdownToBase64(content, file);

			// 复制到剪贴板
			await navigator.clipboard.writeText(convertedContent);

			new Notice('✅ 已复制 Base64 格式到剪贴板');
		} catch (error) {
			new Notice('❌ 复制失败: ' + error.message);
			console.error('复制失败:', error);
		}
	}

	// ========== 功能 2: 另存为新文件 ==========
	async SaveAsBase64(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const convertedContent = await this.ConvertMarkdownToBase64(content, file);

			// 生成新文件名: 原文件名_base64.md
			const baseName = file.basename;
			const newFileName = `${baseName}_base64.md`;
			const newFilePath = file.parent
				? `${file.parent.path}/${newFileName}`
				: newFileName;

			// 创建新文件
			await this.app.vault.create(newFilePath, convertedContent);

			new Notice(`✅ 已保存为: ${newFileName}`);
		} catch (error) {
			new Notice('❌ 保存失败: ' + error.message);
			console.error('保存失败:', error);
		}
	}

	// ========== 核心转换逻辑 ==========
	async ConvertMarkdownToBase64(content: string, sourceFile: TFile): Promise<string> {
		// 匹配 Markdown 图片语法: ![alt](path) 或 ![alt](<path>)
		// 支持 Obsidian 的 ![[image.png]] 语法
		const imgRegex = /!\[([^\]]*)\]\(<?([^)">]+)>?\)|!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]/gi;

		let result = content;
		let convertedCount = 0;
		let skippedCount = 0;

		const matches = [...content.matchAll(imgRegex)];

		for (const match of matches) {
			const fullMatch = match[0];

			// 处理标准 Markdown 语法: ![alt](path)
			if (match[1] !== undefined) {
				const altText = match[1];
				const imagePath = match[2];

				// 跳过已经是 base64 的图片
				if (imagePath.startsWith('data:image')) {
					skippedCount++;
					continue;
				}

				// 跳过网络图片
				if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
					skippedCount++;
					continue;
				}

				// 转换本地图片
				const base64 = await this.ImageToBase64(imagePath, sourceFile);
				if (base64) {
					result = result.replace(fullMatch, `![${altText}](${base64})`);
					convertedCount++;
				} else {
					skippedCount++;
				}
			}
			// 处理 Obsidian Wiki 语法: ![[image.png]]
			else if (match[3] !== undefined) {
				const imageName = match[3];

				// 转换为 base64
				const base64 = await this.ImageToBase64(imageName, sourceFile);
				if (base64) {
					// 转换为标准 Markdown 语法
					result = result.replace(fullMatch, `![${imageName}](${base64})`);
					convertedCount++;
				} else {
					skippedCount++;
				}
			}
		}

		console.log(`转换完成: ${convertedCount} 个图片已转换, ${skippedCount} 个已跳过`);
		return result;
	}

	// ========== 图片转 Base64 ==========
	async ImageToBase64(imagePath: string, sourceFile: TFile): Promise<string | null> {
		try {
			// 解析图片路径
			const imageFile = this.ResolveImagePath(imagePath, sourceFile);
			if (!imageFile) {
				console.warn(`找不到图片: ${imagePath}`);
				return null;
			}

			// 读取图片为 ArrayBuffer
			const arrayBuffer = await this.app.vault.readBinary(imageFile);

			// 转换为 Base64
			const base64 = this.ArrayBufferToBase64(arrayBuffer);

			// 获取 MIME 类型
			const mimeType = this.GetMimeType(imageFile.extension);

			return `data:${mimeType};base64,${base64}`;
		} catch (error) {
			console.error(`转换图片失败: ${imagePath}`, error);
			return null;
		}
	}

	// ========== 路径解析 ==========
	ResolveImagePath(imagePath: string, sourceFile: TFile): TFile | null {
		// 移除 Obsidian 路径前缀
		const cleanPath = imagePath.replace(/^<|>$/g, '').trim();

		// 方法 1: 直接从 Vault 根目录查找
		let file = this.app.vault.getAbstractFileByPath(cleanPath);
		if (file instanceof TFile) {
			return file;
		}

		// 方法 2: 相对于当前文件查找
		if (sourceFile.parent) {
			const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
			file = this.app.vault.getAbstractFileByPath(relativePath);
			if (file instanceof TFile) {
				return file;
			}
		}

		// 方法 3: 使用 Obsidian 的链接解析
		const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
		if (resolvedFile instanceof TFile) {
			return resolvedFile;
		}

		return null;
	}

	// ========== ArrayBuffer 转 Base64 ==========
	ArrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	// ========== 获取 MIME 类型 ==========
	GetMimeType(extension: string): string {
		const mimeTypes: Record<string, string> = {
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'svg': 'image/svg+xml',
			'bmp': 'image/bmp'
		};
		return mimeTypes[extension.toLowerCase()] || 'image/png';
	}
}
