# -*- coding: utf-8 -*-
"""
文件工具模块
提供文件读写、路径处理等辅助功能
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import Optional, Tuple


# ========== 文件读写 ==========
def ReadFile(FilePath: str) -> Optional[str]:
    """
    读取文件内容

    Args:
        FilePath: 文件路径

    Returns:
        文件内容字符串，如果读取失败返回 None
    """
    try:
        with open(FilePath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"读取文件失败: {FilePath}, 错误: {e}")
        return None


def WriteFile(FilePath: str, Content: str) -> bool:
    """
    写入文件内容

    Args:
        FilePath: 文件路径
        Content: 要写入的内容

    Returns:
        成功返回 True，失败返回 False
    """
    try:
        with open(FilePath, 'w', encoding='utf-8') as f:
            f.write(Content)
        return True
    except Exception as e:
        print(f"写入文件失败: {FilePath}, 错误: {e}")
        return False


# ========== 路径处理 ==========
def GetAbsolutePath(ImagePath: str, MarkdownFilePath: str) -> str:
    """
    将相对路径转换为绝对路径

    Args:
        ImagePath: 图片路径（可能是相对路径或绝对路径）
        MarkdownFilePath: Markdown 文件的绝对路径

    Returns:
        图片的绝对路径
    """
    if os.path.isabs(ImagePath):
        return ImagePath

    markdownDir = os.path.dirname(MarkdownFilePath)
    return os.path.normpath(os.path.join(markdownDir, ImagePath))


def EnsureDirectoryExists(FilePath: str) -> bool:
    """
    确保文件所在目录存在，如果不存在则创建

    Args:
        FilePath: 文件路径

    Returns:
        成功返回 True，失败返回 False
    """
    try:
        directory = os.path.dirname(FilePath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        return True
    except Exception as e:
        print(f"创建目录失败: {e}")
        return False


# ========== 文件验证 ==========
def ValidateFilePath(FilePath: str) -> Tuple[bool, str]:
    """
    验证文件路径是否有效

    Args:
        FilePath: 文件路径

    Returns:
        (是否有效, 错误信息)
    """
    if not FilePath:
        return False, "文件路径为空"

    if not os.path.exists(FilePath):
        return False, f"文件不存在: {FilePath}"

    if not os.path.isfile(FilePath):
        return False, f"不是有效的文件: {FilePath}"

    if not os.access(FilePath, os.R_OK):
        return False, f"文件没有读取权限: {FilePath}"

    return True, ""


def IsSupportedImage(FilePath: str) -> bool:
    """
    检查文件是否为支持的图片格式

    Args:
        FilePath: 文件路径

    Returns:
        支持返回 True，不支持返回 False
    """
    supportedExts = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'}
    ext = Path(FilePath).suffix.lower()
    return ext in supportedExts


def GetMimeType(FilePath: str) -> str:
    """
    根据文件扩展名获取 MIME 类型

    Args:
        FilePath: 文件路径

    Returns:
        MIME 类型字符串
    """
    extToMime = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp'
    }
    ext = Path(FilePath).suffix.lower()
    return extToMime.get(ext, 'image/png')
