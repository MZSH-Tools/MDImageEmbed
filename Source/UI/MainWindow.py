# -*- coding: utf-8 -*-
"""
主窗口
MDImageEmbed 的主界面，提供文件选择、编辑、预览和转换功能
"""
from __future__ import annotations
import sys
import os
from pathlib import Path
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QTextEdit, QFileDialog, QMessageBox, QSplitter,
    QLabel, QStatusBar
)
from PyQt6.QtCore import Qt, QTimer, QUrl, Slot
from PyQt6.QtGui import QFont
from PyQt6.QtWebEngineWidgets import QWebEngineView
import markdown2
import pyperclip

from ImageConverter import ImageConverter
from FileUtils import ReadFile, WriteFile, ValidateFilePath


class MainWindow(QMainWindow):
    """
    主窗口类
    提供 Markdown 编辑、预览和图片转换功能
    """

    def __init__(self):
        super().__init__()
        self.CurrentFilePath: str = None       # 当前打开的文件路径
        self.OriginalContent: str = None       # 原始文件内容
        self.PreviewTimer: QTimer = None       # 预览更新定时器

        self.InitUi()

    # ========== UI 初始化 ==========
    def InitUi(self):
        """初始化用户界面"""
        self.setWindowTitle("MDImageEmbed - Markdown 图片内嵌工具")
        self.setGeometry(100, 100, 1200, 800)

        # 中央窗口部件
        centralWidget = QWidget()
        self.setCentralWidget(centralWidget)

        # 主布局
        mainLayout = QVBoxLayout(centralWidget)
        mainLayout.setContentsMargins(10, 10, 10, 10)
        mainLayout.setSpacing(10)

        # ===== 第一行：文件选择区 =====
        fileLayout = QHBoxLayout()

        self.SelectFileBtn = QPushButton("选择文件")
        self.SelectFileBtn.setToolTip("选择要处理的 Markdown 文件")
        self.SelectFileBtn.clicked.connect(self.OnSelectFile)

        self.FilePathLabel = QLabel("未选择文件")
        self.FilePathLabel.setStyleSheet("color: gray;")

        fileLayout.addWidget(self.SelectFileBtn)
        fileLayout.addWidget(self.FilePathLabel, 1)
        mainLayout.addLayout(fileLayout)

        # ===== 第二行：操作按钮区 =====
        buttonLayout = QHBoxLayout()

        self.ConvertBtn = QPushButton("转换")
        self.ConvertBtn.setToolTip("将图片链接转换为 base64 内嵌格式")
        self.ConvertBtn.clicked.connect(self.OnConvert)
        self.ConvertBtn.setEnabled(False)

        self.CopyBtn = QPushButton("复制")
        self.CopyBtn.setToolTip("复制编辑区内容到剪贴板")
        self.CopyBtn.clicked.connect(self.OnCopy)
        self.CopyBtn.setEnabled(False)

        self.OverwriteBtn = QPushButton("覆盖")
        self.OverwriteBtn.setToolTip("覆盖原文件")
        self.OverwriteBtn.clicked.connect(self.OnOverwrite)
        self.OverwriteBtn.setEnabled(False)

        self.SaveAsBtn = QPushButton("另存为")
        self.SaveAsBtn.setToolTip("另存为新文件")
        self.SaveAsBtn.clicked.connect(self.OnSaveAs)
        self.SaveAsBtn.setEnabled(False)

        self.RestoreBtn = QPushButton("还原")
        self.RestoreBtn.setToolTip("恢复到原始内容")
        self.RestoreBtn.clicked.connect(self.OnRestore)
        self.RestoreBtn.setEnabled(False)

        buttonLayout.addWidget(self.ConvertBtn)
        buttonLayout.addWidget(self.CopyBtn)
        buttonLayout.addWidget(self.OverwriteBtn)
        buttonLayout.addWidget(self.SaveAsBtn)
        buttonLayout.addWidget(self.RestoreBtn)
        buttonLayout.addStretch()

        mainLayout.addLayout(buttonLayout)

        # ===== 第三行：左右分栏（编辑区和预览区）=====
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # ---------- 左侧：编辑区 ----------
        editorWidget = QWidget()
        editorLayout = QVBoxLayout(editorWidget)
        editorLayout.setContentsMargins(0, 0, 0, 0)

        editorLabel = QLabel("编辑区")
        editorLabel.setFont(QFont("", 10, QFont.Weight.Bold))

        self.Editor = QTextEdit()
        self.Editor.setFont(QFont("Consolas", 10))
        self.Editor.setPlaceholderText("选择文件后，内容将显示在这里...")
        self.Editor.textChanged.connect(self.OnEditorChanged)

        editorLayout.addWidget(editorLabel)
        editorLayout.addWidget(self.Editor)

        # ---------- 右侧：预览区 ----------
        previewWidget = QWidget()
        previewLayout = QVBoxLayout(previewWidget)
        previewLayout.setContentsMargins(0, 0, 0, 0)

        previewLabel = QLabel("预览区")
        previewLabel.setFont(QFont("", 10, QFont.Weight.Bold))

        self.Preview = QWebEngineView()
        self.Preview.setHtml(self._GetEmptyPreviewHtml())

        previewLayout.addWidget(previewLabel)
        previewLayout.addWidget(self.Preview)

        # 添加到分栏
        splitter.addWidget(editorWidget)
        splitter.addWidget(previewWidget)
        splitter.setSizes([600, 600])  # 默认 50:50

        mainLayout.addWidget(splitter, 1)

        # ===== 状态栏 =====
        self.StatusBar = QStatusBar()
        self.setStatusBar(self.StatusBar)
        self.StatusBar.showMessage("就绪")

        # ===== 预览更新定时器 =====
        self.PreviewTimer = QTimer()
        self.PreviewTimer.setSingleShot(True)
        self.PreviewTimer.timeout.connect(self.UpdatePreview)

    # ========== 事件处理 ==========
    @Slot()
    def OnSelectFile(self):
        """选择 Markdown 文件"""
        filePath, _ = QFileDialog.getOpenFileName(
            self,
            "选择 Markdown 文件",
            "",
            "Markdown Files (*.md *.markdown);;All Files (*)"
        )

        if not filePath:
            return

        # 验证文件
        isValid, errorMsg = ValidateFilePath(filePath)
        if not isValid:
            QMessageBox.critical(self, "错误", errorMsg)
            return

        # 读取文件
        content = ReadFile(filePath)
        if content is None:
            QMessageBox.critical(self, "错误", f"无法读取文件: {filePath}")
            return

        # 更新界面
        self.CurrentFilePath = filePath
        self.OriginalContent = content
        self.FilePathLabel.setText(filePath)
        self.FilePathLabel.setStyleSheet("color: black;")
        self.Editor.setPlainText(content)

        # 启用按钮
        self.ConvertBtn.setEnabled(True)
        self.CopyBtn.setEnabled(True)
        self.OverwriteBtn.setEnabled(True)
        self.SaveAsBtn.setEnabled(True)
        self.RestoreBtn.setEnabled(True)

        # 更新预览
        self.UpdatePreview()

        self.StatusBar.showMessage(f"已加载文件: {Path(filePath).name}")

    @Slot()
    def OnConvert(self):
        """转换图片为 base64 格式"""
        if not self.CurrentFilePath:
            QMessageBox.warning(self, "警告", "请先选择文件")
            return

        currentContent = self.Editor.toPlainText()
        converter = ImageConverter(self.CurrentFilePath)

        try:
            convertedContent, log = converter.ConvertMarkdown(currentContent)
            self.Editor.setPlainText(convertedContent)

            logMessage = "\n".join(log) if log else "没有找到需要转换的图片"
            QMessageBox.information(self, "转换完成", f"转换结果:\n\n{logMessage}")
            self.StatusBar.showMessage("图片转换完成")

        except Exception as e:
            QMessageBox.critical(self, "错误", f"转换失败: {str(e)}")
            self.StatusBar.showMessage("转换失败")

    @Slot()
    def OnCopy(self):
        """复制编辑区内容到剪贴板"""
        content = self.Editor.toPlainText()
        if not content:
            QMessageBox.warning(self, "警告", "编辑区为空")
            return

        try:
            pyperclip.copy(content)
            QMessageBox.information(self, "成功", "内容已复制到剪贴板")
            self.StatusBar.showMessage("已复制到剪贴板")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"复制失败: {str(e)}")

    @Slot()
    def OnOverwrite(self):
        """覆盖原文件"""
        if not self.CurrentFilePath:
            QMessageBox.warning(self, "警告", "没有打开的文件")
            return

        reply = QMessageBox.question(
            self,
            "确认覆盖",
            f"确定要覆盖原文件吗？\n\n{self.CurrentFilePath}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            content = self.Editor.toPlainText()
            if WriteFile(self.CurrentFilePath, content):
                self.OriginalContent = content
                QMessageBox.information(self, "成功", "文件已保存")
                self.StatusBar.showMessage("文件已覆盖保存")
            else:
                QMessageBox.critical(self, "错误", "保存文件失败")
                self.StatusBar.showMessage("保存失败")

    @Slot()
    def OnSaveAs(self):
        """另存为新文件"""
        filePath, _ = QFileDialog.getSaveFileName(
            self,
            "另存为",
            "",
            "Markdown Files (*.md);;All Files (*)"
        )

        if filePath:
            content = self.Editor.toPlainText()
            if WriteFile(filePath, content):
                QMessageBox.information(self, "成功", f"文件已保存到:\n{filePath}")
                self.StatusBar.showMessage(f"已保存到: {Path(filePath).name}")
            else:
                QMessageBox.critical(self, "错误", "保存文件失败")
                self.StatusBar.showMessage("保存失败")

    @Slot()
    def OnRestore(self):
        """还原到原始内容"""
        if not self.OriginalContent:
            QMessageBox.warning(self, "警告", "没有可还原的内容")
            return

        currentContent = self.Editor.toPlainText()
        if currentContent != self.OriginalContent:
            reply = QMessageBox.question(
                self,
                "确认还原",
                "确定要放弃所有修改并还原到原始内容吗？",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )

            if reply == QMessageBox.StandardButton.No:
                return

        self.Editor.setPlainText(self.OriginalContent)
        self.StatusBar.showMessage("已还原到原始内容")

    @Slot()
    def OnEditorChanged(self):
        """编辑区内容改变时触发"""
        # 延迟 500ms 后更新预览
        self.PreviewTimer.stop()
        self.PreviewTimer.start(500)

    # ========== 预览功能 ==========
    def UpdatePreview(self):
        """更新预览区"""
        markdownContent = self.Editor.toPlainText()

        if not markdownContent:
            self.Preview.setHtml(self._GetEmptyPreviewHtml())
            return

        try:
            htmlContent = markdown2.markdown(
                markdownContent,
                extras=[
                    'fenced-code-blocks',
                    'tables',
                    'strike',
                    'task_list',
                    'code-friendly'
                ]
            )

            # 加载 CSS 样式
            cssPath = Path(__file__).parent / 'assets' / 'style.css'
            cssContent = ""
            if cssPath.exists():
                with open(cssPath, 'r', encoding='utf-8') as f:
                    cssContent = f.read()

            # 组合完整 HTML
            fullHtml = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>{cssContent}</style>
            </head>
            <body>
                {htmlContent}
            </body>
            </html>
            """

            # 设置 base URL 为当前文件所在目录
            if self.CurrentFilePath:
                baseUrl = QUrl.fromLocalFile(os.path.dirname(self.CurrentFilePath) + os.sep)
                self.Preview.setHtml(fullHtml, baseUrl)
            else:
                self.Preview.setHtml(fullHtml)

        except Exception as e:
            errorHtml = f"""
            <!DOCTYPE html>
            <html>
            <body>
                <h3 style="color: red;">预览错误</h3>
                <p>{str(e)}</p>
            </body>
            </html>
            """
            self.Preview.setHtml(errorHtml)

    def _GetEmptyPreviewHtml(self) -> str:
        """获取空预览的 HTML"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    font-family: Arial, sans-serif;
                    color: #999;
                }
            </style>
        </head>
        <body>
            <div>预览区域 - 选择文件后内容将在此显示</div>
        </body>
        </html>
        """
