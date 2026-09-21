# mature-content-topic-bank

熟龄内容账号的长期选题库。主数据使用 CSV 维护，Excel 作为查看和选题输出版本。

## 目录

```text
data/
├─ raw/       每日微信 24h 热文榜原始文件
├─ master/    hot_topics.csv、mother_topics.csv、source_manifest.csv
└─ output/    最新版 Excel 与当天选题 CSV
skills/       熟龄爆款选题 Skill v1.0
qa/           生成后的工作簿预览图，仅用于质量检查
```

## 当前首版

截至 2026-09-21，仓库已归档工作区中可取得的每日原始榜单：2026-09-01 至 2026-09-10、2026-09-12 至 2026-09-15、2026-09-20、2026-09-21。2026-09-11、2026-09-16 至 2026-09-19 暂无原始文件，后续补齐后直接放入 `data/raw/` 再更新主库。

用户约定中的 `/mnt/data/微信24h热文榜_题目库_截至20260921.xlsx` 在当前工作区没有以该文件名出现。本首版使用同日 `921432_微信24h热文榜_20260921.xlsx`、历史每日榜单，以及 `老年主题筛选_20260901-20260915.xlsx` 作为可追溯来源，并在 `data/raw/` 中保留原文件。

## 每日更新流程

1. 把当天榜单 CSV 或 XLSX 放入 `data/raw/`。
2. 执行同样的数据整理脚本，或让 Codex 按 `skills/熟龄爆款选题_Skill_v1.0.md` 更新主库。
3. 以链接为第一去重键、标题为第二去重键，更新 `data/master/hot_topics.csv`。
4. 更新 `mother_topics.csv`，生成 `data/output/微信24h热文榜_题目库_截至YYYYMMDD.xlsx` 和当天选题 CSV。
5. 检查新增数、去重数、今日首选题目，再提交并推送 GitHub。

## 去重规则

- 同链接视为同一篇文章。
- 没有链接时使用去空格、统一大小写后的标题。
- 同一文章多日上榜：保留一条主记录，累计 `appearance_count`，保留最高热度 `max_heat`，并记录首次、最近上榜日期。
- 标题轻微变化但链接不同：不自动删除，保留并标记为人工复核对象。

## 母题分析

`mother_topics.csv` 将具体标题归并到可复用的母题，例如“退休后的钱与保障”“女人年龄与自我价值”“子女关系与家庭边界”。母题强度同时参考出现次数、最近出现日期和最高热度，作为选题时的历史验证度。

## 今日选题

今日候选按照当日热度、历史出现次数、熟龄适配度综合排序，输出 1 个首选和最多 2 个备选。选题 Skill 会再检查账号系列、标题骨架、情绪与需求，避免短期重复。

## GitHub 同步

建议仓库名为 `mature-content-topic-bank`。首次推送前，将本地仓库关联到自己的 GitHub 地址：

```bash
git remote add origin https://github.com/<你的用户名>/mature-content-topic-bank.git
git branch -M main
git push -u origin main
```

以后每天完成更新后：

```bash
git add data skills README.md
git commit -m "Update topic bank for YYYY-MM-DD"
git push
```

不要把账号密码或访问令牌写进仓库。推荐使用 GitHub CLI 登录或系统凭据管理器保存认证信息。
