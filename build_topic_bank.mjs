import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.cwd();
const downloads = "C:/Users/Administrator/Downloads";
const asOf = "2026-09-22";
const asOfCompact = "20260922";
const outputDir = path.join(root, "data", "output");
const rawDir = path.join(root, "data", "raw");
const masterDir = path.join(root, "data", "master");
const qaDir = path.join(root, "qa");
await Promise.all([outputDir, rawDir, masterDir, qaDir].map((p) => fs.mkdir(p, { recursive: true })));

const allFiles = await fs.readdir(downloads);
const rawNames = allFiles
  .filter((name) => /^921432_微信24h热文榜_\d{8}\.(csv|xlsx)$/i.test(name))
  .filter((name) => dateFromName(name) >= "2026-09-01")
  .sort();
for (const name of rawNames) await fs.copyFile(path.join(downloads, name), path.join(rawDir, name));

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ""; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function normalizeTitle(s) { return String(s ?? "").replace(/\s+/g, "").trim().toLowerCase(); }
function normalizeLink(s) { return String(s ?? "").trim().replace(/#rd$/, ""); }
function parseHeat(value) {
  const s = String(value ?? "").trim().replace(/,/g, "");
  if (!s) return 0;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return /万/.test(s) ? n * 10000 : n;
}
function compactHeat(n) { return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(Math.round(n)); }
function dateFromName(name) {
  const m = name.match(/(20\d{6})/);
  return m ? `${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}` : "";
}
function safeText(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  return String(v);
}

const categoryRules = [
  ["养老金与医保", /(养老金|退休金|医保|医疗|社保|退休工资|医保共济)/],
  ["财务安全与防骗", /(诈骗|骗术|防骗|银行卡|现金|取现|存款|理财|养老钱|财务)/],
  ["晚年婚姻与亲密关系", /(婚姻|夫妻|老伴|伴侣|分房睡|结婚)/],
  ["代际关系与家庭边界", /(儿女|子女|孩子|儿子|女儿|亲家|婆媳|家庭|父母)/],
  ["女性年龄与自我认同", /(女人|女性|岁后|年龄|漂亮|变老|优雅|自我)/],
  ["健康饮食与运动", /(健康|养生|身体|蔬菜|饮食|运动|疾病|看病|睡眠|血压)/],
  ["身后安排与告别", /(去世|离世|告别|遗嘱|葬|身后|临终)/],
  ["旅游消费与兴趣", /(旅游|旅行|出游|景区|消费|购物|兴趣|退休生活)/],
  ["养老照护与居住", /(养老院|居家|照护|独居|住院|房子|住房|居住)/],
  ["退休适应与再就业", /(退休|再就业|工作|上班|职业)/],
];
const motherByCategory = {
  "养老金与医保": "退休后的钱与保障",
  "财务安全与防骗": "老年财务安全",
  "晚年婚姻与亲密关系": "晚年伴侣与亲密边界",
  "代际关系与家庭边界": "子女关系与家庭边界",
  "女性年龄与自我认同": "女人年龄与自我价值",
  "健康饮食与运动": "50岁后的健康管理",
  "身后安排与告别": "晚年告别与身后安排",
  "旅游消费与兴趣": "退休后的兴趣与生活方式",
  "养老照护与居住": "晚年照护与居住选择",
  "退休适应与再就业": "退休后的身份与第二曲线",
  "其他": "熟龄人群的日常见闻",
};
function classify(title, referenceCategory = "") {
  const category = referenceCategory || categoryRules.find(([, re]) => re.test(title))?.[0] || "其他";
  const matureTerms = /(老人|老年|退休|养老金|医保|儿女|子女|夫妻|女人|女性|50岁|60岁|健康|养老|晚年|防骗|婚姻|父母)/;
  const fit = category !== "其他" ? 85 : matureTerms.test(title) ? 65 : 20;
  const series = /女人|女性|漂亮|年龄|优雅/.test(title) ? "女人的下半场" : "50岁以后";
  const gender = /女人|女性|妻子|老婆|女儿|婆媳/.test(title) ? "女性偏强" : /男人|男性|丈夫|老公|儿子/.test(title) ? "男性偏强" : "通用";
  const emotion = /(告别|去世|离世|孤独|婚姻|夫妻|儿女|孩子)/.test(title) ? "情感共鸣" : /(诈骗|不能|不要|警惕|限制|下架)/.test(title) ? "焦虑提醒" : /(好消息|正式|政策|医保|退休)/.test(title) ? "信息获得" : "好奇/实用";
  const need = category.includes("安全") || category.includes("养老金") ? "降低风险" : category.includes("健康") ? "改善身体" : category.includes("婚姻") || category.includes("代际") ? "关系处理" : category.includes("女性") ? "自我认同" : "获得信息";
  const skeleton = /[?？]/.test(title) ? "问题型" : /我|我们/.test(title) ? "故事型" : /不要|别|警惕|骗|限制/.test(title) ? "提醒警示型" : /好消息|正式|今年|日起/.test(title) ? "政策信息型" : /岁|十年|一块|万/.test(title) ? "数字切入型" : "事件切入型";
  return { category, series, fit, gender, emotion, need, skeleton, mother: motherByCategory[category] || motherByCategory.其他 };
}

const referenceMap = new Map();
const refPath = path.join(downloads, "老年主题筛选_20260901-20260915.xlsx");
if (await fs.stat(refPath).catch(() => null)) {
  const refWb = await SpreadsheetFile.importXlsx(await FileBlob.load(refPath));
  for (const sheetName of ["直接老年主题", "可改造成老年主题"]) {
    const sheet = refWb.worksheets.getItem(sheetName);
    const values = sheet.getUsedRange().values;
    const headers = values[0].map(safeText);
    const titleIdx = headers.indexOf("原始标题");
    const linkIdx = headers.indexOf("链接（原始）");
    const catIdx = headers.indexOf("老年主题分类");
    for (const row of values.slice(1)) {
      const title = safeText(row[titleIdx]);
      const link = normalizeLink(row[linkIdx]);
      const cat = safeText(row[catIdx]);
      if (title && cat) referenceMap.set(`t:${normalizeTitle(title)}`, cat);
      if (link && cat) referenceMap.set(`l:${link}`, cat);
    }
  }
}

const rawRecords = [];
for (const name of rawNames) {
  const full = path.join(downloads, name);
  const day = dateFromName(name);
  let rows;
  if (name.toLowerCase().endsWith(".csv")) rows = parseCsv(await fs.readFile(full, "utf8"));
  else {
    const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(full));
    rows = wb.worksheets.getItemAt(0).getUsedRange().values.map((r) => r.map(safeText));
  }
  if (!rows.length) continue;
  const headers = rows[0].map(safeText);
  const idx = (name) => headers.indexOf(name);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const title = safeText(r[idx("标题")]);
    if (!title) continue;
    const description = safeText(r[idx("描述")]);
    const heatRaw = safeText(r[idx("其他")]);
    const publishTime = safeText(r[idx("发布时间")]);
    const link = normalizeLink(r[idx("链接")]);
    const thumbnail = safeText(r[idx("缩略图")]);
    const refCat = referenceMap.get(`l:${link}`) || referenceMap.get(`t:${normalizeTitle(title)}`) || "";
    const cls = classify(title, refCat);
    rawRecords.push({ day, source_file: name, source_row: i + 1, title, description, heat_raw: heatRaw, heat: parseHeat(heatRaw), publish_time: publishTime, link, thumbnail, ...cls });
  }
}

const unique = new Map();
for (const r of rawRecords) {
  const key = r.link || `title:${normalizeTitle(r.title)}`;
  const existing = unique.get(key);
  if (!existing) {
    unique.set(key, { ...r, first_seen_date: r.day, latest_seen_date: r.day, appearance_count: 1, max_heat: r.heat, latest_heat: r.heat, source_files: [r.source_file], duplicate_status: "唯一" });
  } else {
    existing.first_seen_date = existing.first_seen_date && existing.first_seen_date < r.day ? existing.first_seen_date : r.day;
    existing.latest_seen_date = existing.latest_seen_date > r.day ? existing.latest_seen_date : r.day;
    existing.appearance_count += 1;
    existing.max_heat = Math.max(existing.max_heat, r.heat);
    if (!existing.source_files.includes(r.source_file)) existing.source_files.push(r.source_file);
    if (r.day >= existing.latest_seen_date) Object.assign(existing, { title: r.title, description: r.description, latest_heat: r.heat, publish_time: r.publish_time, thumbnail: r.thumbnail, ...classify(r.title, r.category) });
    existing.duplicate_status = "重复上榜：保留最高热度";
  }
}

const master = [...unique.values()].map((r, i) => ({
  topic_id: `T${String(i + 1).padStart(4, "0")}`,
  first_seen_date: r.first_seen_date,
  latest_seen_date: r.latest_seen_date,
  appearance_count: r.appearance_count,
  max_heat: r.max_heat,
  latest_heat: r.latest_heat,
  title: r.title,
  description: r.description,
  publish_time: r.publish_time,
  link: r.link,
  thumbnail: r.thumbnail,
  series: r.series,
  category: r.category,
  mother_topic: r.mother,
  mature_fit: r.fit,
  audience_age: r.fit >= 60 ? "50岁以上" : "泛人群",
  gender_tendency: r.gender,
  emotion: r.emotion,
  need: r.need,
  title_skeleton: r.skeleton,
  source_files: r.source_files.join(";"),
  duplicate_status: r.duplicate_status,
  data_note: r.category === "其他" ? "未命中历史老年主题分类，保留待人工判断" : "引用历史老年主题分类或规则映射",
})).sort((a, b) => b.max_heat - a.max_heat || b.latest_seen_date.localeCompare(a.latest_seen_date));

const mothers = new Map();
for (const r of master.filter((x) => x.mature_fit >= 60)) {
  const m = mothers.get(r.mother_topic) || { mother_topic: r.mother_topic, appearance_count: 0, latest_seen_date: "", max_heat: 0, series: r.series, category: r.category, topic_count: 0 };
  m.appearance_count += r.appearance_count; m.topic_count += 1; m.max_heat = Math.max(m.max_heat, r.max_heat); m.latest_seen_date = m.latest_seen_date > r.latest_seen_date ? m.latest_seen_date : r.latest_seen_date; mothers.set(r.mother_topic, m);
}
const motherRows = [...mothers.values()].map((m) => ({ ...m, current_level: m.max_heat >= 100000 && m.appearance_count >= 3 ? "S" : m.max_heat >= 50000 ? "A" : "B" })).sort((a, b) => b.appearance_count - a.appearance_count || b.max_heat - a.max_heat);

function recommendTitle(r) {
  if (r.category === "代际关系与家庭边界") return "人到晚年才明白：儿女真正能托底的，不是钱，而是这份担当";
  if (r.category === "健康饮食与运动") return "身体这处毛发变白，真的暗示活不长吗？50岁后先别急着下结论";
  return r.title;
}
const today = master.filter((r) => r.latest_seen_date === asOf && r.mature_fit >= 60 && !/(男篮|女篮|球队|足球|篮球|电竞|游戏|世界赛|季后赛|S\s*赛)/.test(r.title))
  .map((r) => ({ ...r, score: r.max_heat / 10000 + r.appearance_count * 5 + r.mature_fit / 10 }))
  .sort((a, b) => b.score - a.score).slice(0, 3)
  .map((r, i) => ({ rank: i + 1, level: i === 0 ? "S" : "A", selection_reason: i === 0 ? "当日热点强度与历史验证度最高，且适合熟龄账号" : "具备熟龄改造空间，作为今日备选", recommended_title: recommendTitle(r), ...r }));

const masterHeaders = ["topic_id","first_seen_date","latest_seen_date","appearance_count","max_heat","latest_heat","title","description","publish_time","link","thumbnail","series","category","mother_topic","mature_fit","audience_age","gender_tendency","emotion","need","title_skeleton","source_files","duplicate_status","data_note"];
const motherHeaders = ["mother_topic","appearance_count","topic_count","latest_seen_date","max_heat","series","category","current_level"];
const todayHeaders = ["rank","level","selection_reason","recommended_title",...masterHeaders,"score"];
const toCsv = (headers, rows) => [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n";
await fs.writeFile(path.join(masterDir, "hot_topics.csv"), toCsv(masterHeaders, master), "utf8");
await fs.writeFile(path.join(masterDir, "mother_topics.csv"), toCsv(motherHeaders, motherRows), "utf8");
await fs.writeFile(path.join(outputDir, "today_selection_20260922.csv"), toCsv(todayHeaders, today), "utf8");
await fs.writeFile(path.join(masterDir, "source_manifest.csv"), toCsv(["source_file","date","format","status"], rawNames.map((name) => ({ source_file: name, date: dateFromName(name), format: path.extname(name).slice(1).toLowerCase(), status: "已归档" }))), "utf8");

const workbook = Workbook.create();
const overview = workbook.worksheets.add("概览");
const rawSheet = workbook.worksheets.add("原始题目库");
const matureSheet = workbook.worksheets.add("熟龄题目分析");
const motherSheet = workbook.worksheets.add("母题库");
const todaySheet = workbook.worksheets.add("今日选题");
const font = "Arial";
for (const s of [overview, rawSheet, matureSheet, motherSheet, todaySheet]) { s.showGridLines = false; s.getRange("A1:Z2").format.font = { name: font, size: 10 }; }

overview.getRange("A1").values = [["熟龄爆款选题库"]];
overview.getRange("A2").values = [[`截至 ${asOf}，主数据来自每日微信24h热文榜与历史熟龄主题筛选表`]];
overview.getRange("A4:B10").values = [
  ["指标", "值"], ["主库去重题目数", master.length], ["熟龄适配题目数", master.filter((r) => r.mature_fit >= 60).length], ["母题数", motherRows.length], ["归档原始文件数", rawNames.length], ["可追溯最早日期", master.map((r) => r.first_seen_date).sort()[0] || ""], ["今日候选数", today.length],
];
overview.getRange("D4:G10").values = [
  ["使用说明", "", "", ""], ["主数据", "data/master/hot_topics.csv", "", ""], ["每日原始榜单", "data/raw/", "", ""], ["Excel查看版", `data/output/微信24h热文榜_题目库_截至${asOfCompact}.xlsx`, "", ""], ["Skill", "skills/熟龄爆款选题_Skill_v1.0.md", "", ""], ["历史缺口", "2026-09-11、2026-09-16至2026-09-19暂无原始文件", "", ""], ["同步建议", "每日更新后提交并推送 GitHub", "", ""],
];
overview.getRange("A1:G1").format = { font: { name: font, size: 16, bold: true, color: "#1F2937" } };
overview.getRange("A4:B4").format = { fill: "#1F4E78", font: { name: font, bold: true, color: "#FFFFFF" } };
overview.getRange("D4:G4").format = { fill: "#5B6470", font: { name: font, bold: true, color: "#FFFFFF" } };
overview.getRange("A4:B10").format.borders = { preset: "outside", style: "thin", color: "#D9E2F3" };
overview.getRange("D4:G10").format.borders = { preset: "outside", style: "thin", color: "#D9E2F3" };
overview.getRange("A1:G10").format.verticalAlignment = "center";
overview.getRange("A:A").format.columnWidth = 22; overview.getRange("B:B").format.columnWidth = 18; overview.getRange("C:C").format.columnWidth = 3; overview.getRange("D:D").format.columnWidth = 16; overview.getRange("E:E").format.columnWidth = 58; overview.getRange("F:G").format.columnWidth = 12;

function fillDataSheet(sheet, headers, rows, title, tableName, options = {}) {
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1:Z1").format = { font: { name: font, size: 14, bold: true, color: "#1F2937" } };
  sheet.getRange("A3").resize(1, headers.length).values = [headers];
  if (rows.length) sheet.getRange("A4").resize(rows.length, headers.length).values = rows.map((r) => headers.map((h) => r[h] ?? ""));
  const endRow = Math.max(3, rows.length + 3);
  sheet.getRange(`A3:${String.fromCharCode(64 + Math.min(headers.length, 26))}3`).format = { fill: "#1F4E78", font: { name: font, bold: true, color: "#FFFFFF" }, wrapText: true };
  sheet.getRange(`A3:${String.fromCharCode(64 + Math.min(headers.length, 26))}${endRow}`).format.verticalAlignment = "center";
  if (rows.length) { const table = sheet.tables.add(`A3:${String.fromCharCode(64 + Math.min(headers.length, 26))}${endRow}`, true, tableName); table.style = "TableStyleMedium2"; }
  sheet.freezePanes.freezeRows(3);
  const widths = options.widths || [];
  for (let i = 0; i < headers.length; i++) sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidth = widths[i] || 18;
}

const rawHeaders = ["topic_id","first_seen_date","latest_seen_date","appearance_count","max_heat","latest_heat","title","description","publish_time","link","series","category","mother_topic","mature_fit","audience_age","gender_tendency","emotion","need","title_skeleton","duplicate_status"];
fillDataSheet(rawSheet, rawHeaders, master, "原始题目库（去重主表）", "RawTopics", { widths: [12,14,14,12,12,12,42,28,20,42,16,18,24,12,14,14,14,14,16,22] });
rawSheet.getRange(`E4:F${master.length + 3}`).format.numberFormat = "#,##0";
const matureRows = master.filter((r) => r.mature_fit >= 60);
fillDataSheet(matureSheet, rawHeaders.concat(["source_files","data_note"]), matureRows, "熟龄题目分析", "MatureTopics", { widths: [12,14,14,12,12,12,42,28,20,42,16,18,24,12,14,14,14,14,16,22,40,34] });
matureSheet.getRange(`E4:F${matureRows.length + 3}`).format.numberFormat = "#,##0";
fillDataSheet(motherSheet, motherHeaders, motherRows, "母题库", "MotherTopics", { widths: [28,16,14,16,14,18,22,14] });
motherSheet.getRange(`E4:E${motherRows.length + 3}`).format.numberFormat = "#,##0";
fillDataSheet(todaySheet, todayHeaders, today, `今日选题（${asOf}）`, "TodayPicks", { widths: [8,8,30,42,12,14,14,12,12,12,42,28,20,42,42,16,18,24,12,14,14,14,14,16,22,12] });
todaySheet.getRange(`F4:G${today.length + 3}`).format.numberFormat = "#,##0";

workbook.recalculate();
for (const sheet of [overview, rawSheet, matureSheet, motherSheet, todaySheet]) {
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(qaDir, `${sheet.name}.png`), new Uint8Array(await preview.arrayBuffer()));
}
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(path.join(outputDir, `微信24h热文榜_题目库_截至${asOfCompact}.xlsx`));
console.log(JSON.stringify({ rawFiles: rawNames.length, rawRecords: rawRecords.length, uniqueTopics: master.length, matureTopics: matureRows.length, mothers: motherRows.length, todayPicks: today.length }));
