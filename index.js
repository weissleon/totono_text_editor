const PATH_DIR_SRC = "./src";
const PATH_DIR_TRANS = "./trans";
const PATH_DIR_OUT = "./out";

async function getTranslationData() {
  const ExcelJS = require("exceljs");
  const path = require("path");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(
    path.join(PATH_DIR_TRANS, "translation_data.xlsx")
  );

  const worksheet = workbook.getWorksheet("scenario");

  const rows = worksheet.getRows(1, worksheet.rowCount);

  const translationData = [];
  for (const row of rows) {
    if (row.values[4] === undefined) continue;
    const key =
      typeof row.values[1] === "object"
        ? row.values[1]["richText"][0].text
        : row.values[1];
    const original =
      typeof row.values[4] === "object"
        ? row.values[4]["richText"][0].text
        : row.values[4];
    const translation =
      typeof row.values[6] === "object"
        ? row.values[6]["richText"][0].text
        : row.values[6];

    translationData.push([key, original, translation]);
  }

  return translationData;
}

async function run() {
  const filePath = process.argv[2];
  const path = require("path");
  const translationData = await getTranslationData();

  const fs = require("fs/promises");
  const srcText = await fs.readFile(filePath, { encoding: "utf-8" });

  console.log(srcText);

  const startTag = "/*<JP>";
  const endTag = "*/";

  let transText = "";
  let cursor = 0;

  if (srcText.indexOf(startTag) === -1) {
    transText = srcText;
    await fs.writeFile(path.join(PATH_DIR_OUT, path.basename(filePath)));
    return;
  }

  while (true) {
    transText += srcText.substring(
      cursor,
      srcText.indexOf(startTag) + startTag.length
    );
    cursor = srcText.indexOf(startTag) + startTag.length;

    const jp = srcText
      .substring(cursor, srcText.indexOf(endTag))
      .replace(/\n/, "");
    console.log("Japanese:", jp);

    transText += srcText.substring(
      cursor,
      srcText.indexOf(endTag) + endTag.length
    );
    cursor = srcText.indexOf(endTag) + endTag.length;

    transText += srcText.substring(cursor, srcText.indexOf(`$"`));
  }
}

run();

// const path = require("path");

// function readFileList(dirPath) {
//   const fs = require("fs");
//   const fileList = fs.readdirSync(dirPath, { encoding: "utf8" });

//   return fileList;
// }

// function readFile(filePath) {
//   const fs = require("fs");
//   const text = fs.readFileSync(filePath, { encoding: "utf-8" });

//   return text;
// }

// function extractTargets(text) {
//   const targets = text.match(/(?<=\$"[\r\n]*).+(?=[\r\n]*";)/gi);

//   return targets;
// }

// async function readTranslationData(filePath) {
//   const EXCEL = require("exceljs");
//   const workbook = new EXCEL.Workbook();
//   await workbook.xlsx.readFile(filePath);

//   const worksheet = workbook.worksheets[0];

//   const rowCount = worksheet.rowCount;
//   const rows = worksheet.getRows(2, rowCount - 1);

//   const data = [];
//   for (const row of rows) {
//     const original = row.getCell("D").text;
//     const translation = row.getCell("F").text;

//     data.push([original, translation]);
//   }

//   return data;
// }

// function exportText(text, outputPath) {
//   const fs = require("fs");
//   fs.writeFileSync(outputPath, text, { encoding: "utf-8" });
// }

// function swapText(target, source) {}

// async function run() {
//   const fileList = readFileList(PATH_DIR_SRC);

//   //   const filePath = path.join(PATH_DIR_SRC, fileList[0]);

//   const transData = await readTranslationData(
//     path.join(PATH_DIR_TRANS, "translation_data.xlsx")
//   );

//   for (const file of fileList) {
//     const filePath = path.join(PATH_DIR_SRC, file);
//     let text = readFile(filePath);
//     // const targets = extractTargets(text);

//     for (const datum of transData) {
//       if (datum[0] === "" || text.includes(datum[0]) === null)
//         console.log(datum, "not Matched!");
//       else text = text.replace(datum[0], datum[1]);
//     }

//     exportText(text, path.join(PATH_DIR_OUT, file));
//   }
// }

// run();
