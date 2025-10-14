# -*- coding: utf-8 -*-
"""
测试路径解析
"""
import os
import sys
import re

# 添加路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "Source", "Logic"))

from ImageConverter import ImageConverter

# 测试文件路径
md_path = r"D:\GitHub\mengzhishanghun\MyObsidian\笔记\积累\Perforce\入门系列\01-Perforce快速上手：安装配置完全指南.md"

print("=" * 60)
print("测试 Markdown 文件路径解析")
print("=" * 60)
print(f"MD文件: {md_path}")
print(f"MD文件存在: {os.path.exists(md_path)}")
print(f"MD文件目录: {os.path.dirname(md_path)}")
print()

# 创建转换器
converter = ImageConverter(md_path)

# 测试各种路径格式
test_cases = [
    "</附件/asynccode-1.png>",
    "/附件/asynccode-1.png",
    "附件/asynccode-1.png",
    "../../../附件/asynccode-1.png",
]

print("=" * 60)
print("测试路径解析")
print("=" * 60)

for original_path in test_cases:
    print(f"\n原始路径: {original_path}")

    # 移除尖括号
    clean_path = original_path.strip('<>')
    print(f"  清理后: {clean_path}")

    # 获取绝对路径
    abs_path = converter._GetAbsolutePath(clean_path)
    print(f"  绝对路径: {abs_path}")

    # 检查文件是否存在
    exists = os.path.exists(abs_path)
    print(f"  文件存在: {exists}")

    if not exists:
        # 尝试从仓库根目录查找
        repo_root = r"D:\GitHub\mengzhishanghun\MyObsidian"
        alt_path = os.path.normpath(os.path.join(repo_root, clean_path.lstrip('/')))
        alt_exists = os.path.exists(alt_path)
        print(f"  从仓库根查找: {alt_path}")
        print(f"  根目录存在: {alt_exists}")

print("\n" + "=" * 60)
print("检查附件目录")
print("=" * 60)

# 检查可能的附件目录位置
possible_dirs = [
    os.path.join(os.path.dirname(md_path), "附件"),
    os.path.join(os.path.dirname(md_path), "..", "附件"),
    os.path.join(os.path.dirname(md_path), "..", "..", "附件"),
    os.path.join(os.path.dirname(md_path), "..", "..", "..", "附件"),
    r"D:\GitHub\mengzhishanghun\MyObsidian\附件",
]

for dir_path in possible_dirs:
    norm_path = os.path.normpath(dir_path)
    exists = os.path.isdir(norm_path)
    print(f"{norm_path}")
    print(f"  存在: {exists}")
    if exists:
        # 列出一些文件
        files = os.listdir(norm_path)[:3]
        print(f"  示例文件: {files}")
    print()
