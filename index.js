const PATH_DIR_SRC = "./src";
const PATH_DIR_TRANS = "./trans";
const PATH_DIR_OUT = "./out";

async function getTranslationDataCsv() {
  const fs = require("fs/promises");
  const path = require("path");
  const csvText = await fs.readFile(
    path.join(PATH_DIR_TRANS, "translation_data.csv"),
    { encoding: "utf-8" }
  );

  const Papa = require("papaparse");
  const result = Papa.parse(csvText, { delimiter: ",", skipEmptyLines: true });
  const data = result.data
    .map((datum) => [datum[0], datum[3], datum[5]])
    .filter((datum) => datum[1] !== "");
  return data;
}

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

async function translate(srcText, translationData) {
  const refStartTag = "/*<JP>";
  const refEndTag = "*/";
  const swapStartTag = '$"';
  const swapEndTag = '";';

  const lines = srcText.split(/\r\n/);

  let isRef = false;
  let isSwapArea = false;
  let isTransPlanted = false;
  let src = "";
  let translation = "";
  let builder = [];

  let finalBuilder = [];

  const prompts = require("prompts");

  for (const line of lines) {
    // When the src is one-liner
    if (line.includes(refStartTag) && line.includes(refEndTag)) {
      const startIdx = line.indexOf(refStartTag) + refStartTag.length;
      const endIdx = line.indexOf(refEndTag);

      src = line.substring(startIdx, endIdx);
      console.log("one-liner");
      console.log("src:\n" + src);
      finalBuilder.push(line);
      continue;
    }

    if (line.includes(swapStartTag) && line.includes(swapEndTag)) {
      const startIdx = line.indexOf(swapStartTag) + swapStartTag.length;
      const endIdx = line.indexOf(swapStartTag);

      console.log(`The src is ${src}`);
      const datum = translationData.filter((datum) => {
        // console.log(datum[1]);
        return datum[1] === src;
      });

      let translation = null;
      if (datum.length === 0) {
        const response = await prompts([
          {
            type: "text",
            name: "translation",
            message: `Unmatched segment found:\n${src}\n\nHow would you like to replace?`,
            initial: src,
          },
        ]);
        translation = response.translation;
      } else {
        translation = datum[0][2];
      }

      const swapData = line.slice(0, startIdx) + translation + swapEndTag;
      console.log("one-liner");
      console.log("trans:\n" + translation);
      finalBuilder.push(swapData);
      continue;
    }

    if (line.includes(swapStartTag)) {
      isSwapArea = true;
      translation = "";
      finalBuilder.push(line);
      continue;
    }

    if (line.includes(swapEndTag) && isSwapArea) {
      isSwapArea = false;
      isTransPlanted = false;
      finalBuilder.push(line);
      continue;
    }

    if (line.includes(refStartTag)) {
      isRef = true;
      src = "";
      finalBuilder.push(line);
      continue;
    }

    if (line.includes(refEndTag) && isRef) {
      isRef = false;
      src = builder.join("\r\n");
      builder = [];
      console.log("src:\n" + src);
      finalBuilder.push(line);
      continue;
    }

    if (isSwapArea) {
      if (line.includes("//") || line.match(/<.+>$/)) {
        finalBuilder.push(line);
        continue;
      }
      if (!isTransPlanted) {
        const datum = translationData.filter(
          (datum) => datum[1].replace("\n", "\r\n") === src
        );
        let translation = null;

        console.log(`datum: ${datum}`);

        if (datum.length === 0) {
          const response = await prompts([
            {
              type: "text",
              name: "translation",
              message: `Unmatched segment found:\n${src}\n\nHow would you like to replace?`,
              initial: src,
            },
          ]);
          translation = response.translation;
        } else {
          translation = datum[0][2];
        }
        finalBuilder.push(translation);
        isTransPlanted = true;
        isSwapArea = true;
      }
      continue;
    }

    if (isRef) {
      if (!line.includes("//") && !line.match(/<.+>$/)) builder.push(line);
      finalBuilder.push(line);
      continue;
    }

    finalBuilder.push(line);
  }

  const finalText = finalBuilder.join("\r\n");

  return finalText;
}

async function run() {
  const filePath = process.argv[2];
  const path = require("path");
  const translationData = await getTranslationDataCsv();

  const fs = require("fs/promises");
  const srcText = await fs.readFile(filePath, { encoding: "utf-8" });

  const finalText = await translate(srcText, translationData);

  try {
    await fs.access(PATH_DIR_OUT);
  } catch (error) {
    await fs.mkdir(PATH_DIR_OUT);
  }

  await fs.writeFile(
    path.join(PATH_DIR_OUT, path.basename(filePath)),
    finalText
  );

  // console.log(srcText);

  // let transText = "";
  // let cursor = 0;

  // if (srcText.indexOf(refStartTag) === -1) {
  //   transText = srcText;
  //   await fs.writeFile(path.join(PATH_DIR_OUT, path.basename(filePath)));
  //   return;
  // }

  // while (true) {
  //   transText += srcText.substring(
  //     cursor,
  //     srcText.indexOf(startTag) + startTag.length
  //   );
  //   cursor = srcText.indexOf(startTag) + startTag.length;

  //   const jp = srcText
  //     .substring(cursor, srcText.indexOf(endTag))
  //     .replace(/\n/, "");
  //   console.log("Japanese:", jp);

  //   transText += srcText.substring(
  //     cursor,
  //     srcText.indexOf(endTag) + endTag.length
  //   );
  //   cursor = srcText.indexOf(endTag) + endTag.length;

  //   transText += srcText.substring(cursor, srcText.indexOf(`$"`));
  // }
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
