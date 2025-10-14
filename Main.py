# -*- coding: utf-8 -*-
"""
MDImageEmbed - Markdown 图片内嵌工具
主入口文件
"""
import os
import sys

# ========== 路径注入 ==========
def InjectSysPath():
    """将 Source 目录添加到系统路径"""
    base = os.path.dirname(os.path.abspath(__file__))
    for p in [
        os.path.join(base, "Source", "UI"),
        os.path.join(base, "Source", "Logic")
    ]:
        if p not in sys.path:
            sys.path.insert(0, p)

InjectSysPath()

# ========== 导入模块 ==========
from PyQt6.QtWidgets import QApplication
from MainWindow import MainWindow

# ========== 主函数 ==========
def Main():
    """程序主入口"""
    app = QApplication(sys.argv)
    app.setApplicationName("MDImageEmbed")
    app.setOrganizationName("MZSH-Tools")

    window = MainWindow()
    window.show()

    sys.exit(app.exec())

if __name__ == '__main__':
    Main()
