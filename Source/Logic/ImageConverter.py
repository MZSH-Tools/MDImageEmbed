# -*- coding: utf-8 -*-
"""
图片转换器
负责扫描 Markdown 内容中的图片链接，将其转换为 base64 内嵌格式
"""
from __future__ import annotations
import re
import base64
import os
from typing import List, Tuple, Optional
from PIL import Image
from io import BytesIO


class ImageConverter:
    """
    Markdown 图片转 Base64 转换器
    负责将 Markdown 文件中的本地图片转换为 base64 内嵌格式
    """

    def __init__(self, MarkdownFilePath: str):
        """
        初始化转换器

        Args:
            MarkdownFilePath: Markdown 文件的绝对路径
        """
        self.MarkdownFilePath = MarkdownFilePath
        self.ConversionLog: List[str] = []

    # ========== 公共接口 ==========
    def ConvertMarkdown(self, MarkdownContent: str) -> Tuple[str, List[str]]:
        """
        转换 Markdown 内容中的所有图片为 base64 格式

        Args:
            MarkdownContent: 原始 Markdown 内容

        Returns:
            (转换后的内容, 日志列表)
        """
        self.ConversionLog.clear()

        # 匹配 Markdown 图片语法: ![alt](path) 或 ![alt](path "title")
        # 支持路径被尖括号包裹的情况: ![alt](<path>)
        pattern = r'!\[([^\]]*)\]\(<?([^)"\s>]+)>?(?:\s+"[^"]*")?\)'

        def ReplaceImage(match):
            """替换单个图片引用"""
            altText = match.group(1)
            imagePath = match.group(2)  # 已自动去除尖括号

            # 跳过已经是 base64 的图片
            if imagePath.startswith('data:image'):
                self.ConversionLog.append(f"跳过（已是base64）: {altText}")
                return match.group(0)

            # 跳过网络链接
            if imagePath.startswith(('http://', 'https://')):
                self.ConversionLog.append(f"跳过（网络链接）: {imagePath}")
                return match.group(0)

            # 转换为绝对路径
            absolutePath = self._GetAbsolutePath(imagePath)

            # 检查文件是否存在
            if not os.path.exists(absolutePath):
                self.ConversionLog.append(f"❌ 文件不存在: {imagePath}")
                return match.group(0)

            # 检查是否为支持的图片格式
            if not self._IsSupportedImage(absolutePath):
                self.ConversionLog.append(f"❌ 不支持的格式: {imagePath}")
                return match.group(0)

            # 转换为 base64
            try:
                base64Data = self._ImageToBase64(absolutePath)
                mimeType = self._GetMimeType(absolutePath)
                base64Url = f"data:{mimeType};base64,{base64Data}"

                self.ConversionLog.append(f"✓ 成功转换: {imagePath}")
                return f"![{altText}]({base64Url})"

            except Exception as e:
                self.ConversionLog.append(f"❌ 转换失败: {imagePath} - {str(e)}")
                return match.group(0)

        # 执行替换
        convertedContent = re.sub(pattern, ReplaceImage, MarkdownContent)
        return convertedContent, self.ConversionLog

    def CountImages(self, MarkdownContent: str) -> dict:
        """
        统计 Markdown 内容中的图片数量

        Args:
            MarkdownContent: Markdown 内容

        Returns:
            包含统计信息的字典 {'total', 'base64', 'http', 'local'}
        """
        # 支持尖括号包裹的路径
        pattern = r'!\[([^\]]*)\]\(<?([^)"\s>]+)>?(?:\s+"[^"]*")?\)'
        matches = re.findall(pattern, MarkdownContent)

        total = len(matches)
        base64Count = 0
        httpCount = 0
        localCount = 0

        for altText, imagePath in matches:
            if imagePath.startswith('data:image'):
                base64Count += 1
            elif imagePath.startswith(('http://', 'https://')):
                httpCount += 1
            else:
                localCount += 1

        return {
            'total': total,
            'base64': base64Count,
            'http': httpCount,
            'local': localCount
        }

    # ========== 私有方法 ==========
    def _ImageToBase64(self, ImagePath: str) -> str:
        """
        将图片文件转换为 base64 字符串

        Args:
            ImagePath: 图片文件的绝对路径

        Returns:
            base64 编码的字符串
        """
        # SVG 文件直接读取
        if ImagePath.lower().endswith('.svg'):
            with open(ImagePath, 'rb') as f:
                return base64.b64encode(f.read()).decode('utf-8')

        # 其他图片使用 Pillow 处理
        try:
            with Image.open(ImagePath) as img:
                # RGBA 模式的 JPEG 转换为 RGB
                if img.mode == 'RGBA' and ImagePath.lower().endswith(('.jpg', '.jpeg')):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background

                # 保存到内存缓冲区
                buffer = BytesIO()
                imgFormat = img.format if img.format else 'PNG'

                if imgFormat == 'JPEG':
                    img.save(buffer, format=imgFormat, quality=95)
                else:
                    img.save(buffer, format=imgFormat)

                buffer.seek(0)
                return base64.b64encode(buffer.read()).decode('utf-8')

        except Exception as e:
            raise Exception(f"图片处理失败: {str(e)}")

    def _GetAbsolutePath(self, ImagePath: str) -> str:
        """
        将相对路径转换为绝对路径

        Args:
            ImagePath: 图片路径（可能是相对或绝对路径）

        Returns:
            图片的绝对路径
        """
        # 移除开头的 / (Obsidian 等工具会添加 / 前缀,但这不是真正的绝对路径)
        # 例如: </附件/image.png> -> 附件/image.png
        hasLeadingSlash = ImagePath.startswith('/') and not ImagePath.startswith('//')
        if hasLeadingSlash:
            ImagePath = ImagePath.lstrip('/')

        if os.path.isabs(ImagePath):
            return ImagePath

        markdownDir = os.path.dirname(self.MarkdownFilePath)

        # 如果路径以 / 开头(已去除),可能是相对于仓库根目录
        # 优先尝试从可能的仓库根目录查找 (Obsidian 模式)
        if hasLeadingSlash:
            # 向上查找可能的仓库根目录 (最多向上5层)
            currentDir = markdownDir
            for _ in range(5):
                testPath = os.path.normpath(os.path.join(currentDir, ImagePath))
                if os.path.exists(testPath):
                    return testPath
                parentDir = os.path.dirname(currentDir)
                if parentDir == currentDir:  # 已到达根目录
                    break
                currentDir = parentDir

        # 否则基于 MD 文件所在目录解析
        return os.path.normpath(os.path.join(markdownDir, ImagePath))

    def _IsSupportedImage(self, FilePath: str) -> bool:
        """检查是否为支持的图片格式"""
        supportedExts = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'}
        ext = os.path.splitext(FilePath)[1].lower()
        return ext in supportedExts

    def _GetMimeType(self, FilePath: str) -> str:
        """根据文件扩展名获取 MIME 类型"""
        extToMime = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp'
        }
        ext = os.path.splitext(FilePath)[1].lower()
        return extToMime.get(ext, 'image/png')
