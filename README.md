# KsWeb

- 作者: K_Lan

## 项目概述

KsWeb 是一个基于 Cloudflare Pages 托管的静态网页工具集合，提供多种实用的在线工具。主要面向开发者、设计师和游戏玩家，提供便捷的工具服务。

## 主要功能

| 工具名 | 工具标识符 | 功能 | 特性 |
| --- | --- | --- | --- |
| 调色板 | ColorTools | 交互式颜色选择器 | 支持 RGB、HEX、HSL、CMYK、LAB |
| 《迷你世界》图片转像素画 | MNPixelPic | 将图片转换为《迷你世界》中的像素画脚本 | 支持 **3.0 和 2.0 版本** 脚本生成 |
| 《迷你世界》物品ID查询 | MNIdViewer | 提供《迷你世界》游戏中所有物品的ID信息 | 支持分类筛选&搜索，分页显示 |

## 技术栈

- **前端框架**: 纯 HTML5 + CSS3 + JavaScript (ES6+)
- **样式**: 自定义 CSS，支持响应式设计
- **图标**: Font Awesome 6.4.0
- **字体**: Inter 字体族
- **部署**: Cloudflare Pages
- **数据源**: 外部 JSON API (物品数据)

## 项目结构

```shell
./
├── index.html              # 主页
├── about.html              # 关于页面
├── tools/
│   ├── colorTools.html     # 颜色工具页面
│   ├── MNIdViewer.html     # 物品ID查看器页面
│   └── MNPixelPic.html     # 像素画转换工具页面
├── static/
│   └── css/
│       ├── index.css       # 主页样式
│       ├── about.css       # 关于页面样式
│       ├── colorTools.css  # 颜色工具样式
│       ├── MNIdViewer.css  # ID查看器样式
│       ├── MNPixelPic.css  # 像素画工具样式
│       └── hideScrollbar.css # 滚动条隐藏样式
└── README.md               # 项目说明
```

## 使用方法

1. **访问主页**: 打开 `index.html` 查看所有可用工具
2. **选择工具**: 点击相应工具卡片进入具体功能页面
3. **使用工具**: 根据页面提示进行操作

## 注意事项

- 本项目为纯静态网站，无需后端服务
- 《迷你世界》相关工具**数据来源于网络，与官方无关**
- 建议使用现代浏览器访问以获得最佳体验
