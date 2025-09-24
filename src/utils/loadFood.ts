// import * as XLSX from "xlsx";

// export async function loadFoods() {
//   const res = await fetch("/foods.xlsx");
//   const buf = await res.arrayBuffer();
//   const wb: XLSX.WorkBook = XLSX.read(buf, { type: "array" });

//   // ✅ Kiểm tra tên sheet trước khi truy cập
//   const firstSheetName = wb.SheetNames[0];
//   if (!firstSheetName) {
//     throw new Error("Không tìm thấy sheet nào trong file Excel.");
//   }

//   const ws = wb.Sheets[firstSheetName];
//   if (!ws) {
//     throw new Error(`Không tìm thấy sheet: ${firstSheetName}`);
//   }

//   const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
//   return rows;
// }
