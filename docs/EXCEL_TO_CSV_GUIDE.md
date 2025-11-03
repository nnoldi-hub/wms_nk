# 🚨 Excel Import Issue - Quick Fix Guide

## ❌ Problem Seen

When uploading Excel file (.xlsx), the preview shows corrupted data:
```
PK���E��yh�����[Content_Types].xml���
����������@��������������������
```

**Cause:** Excel file format is not compatible or has encoding issues.

---

## ✅ SOLUTION: Save as CSV

### Step-by-Step Instructions:

**1. Open your Excel file**

**2. Click "File" → "Save As"**

**3. Choose location to save**

**4. In "Save as type" dropdown, select:**
   - **CSV (Comma delimited) (*.csv)**
   - OR **CSV UTF-8 (Comma delimited) (*.csv)**

**5. Click "Save"**

**6. If Excel shows warning "Do you want to save as CSV?"**
   - Click **"Yes"** to confirm

**7. Upload the NEW .csv file** to WMS import

---

## 📊 Expected File Format

### Option A: CSV with Header (Recommended)
```csv
Cod produs,Produs,Lot intrare,Cantitate
ACBYCY 16/16,Cable ACBYCY 16/16,##E1200 ELP 0-1083 1083 M,0.083
ACSR 185/32,Cable ACSR 185/32,##E1700 HES 3090-0 3090 M,3.090
```

### Option B: CSV without Header (Auto-detected)
```csv
ACBYCY 16/16,##E1200 ELP 0-1083 1083 M,0.083,3350.00
ACSR 185/32,##E1700 HES 3090-0 3090 M,3.090,12438.78
```

**Column Order (when no header):**
1. **Column 1**: Product Code/SKU
2. **Column 2**: Lot intrare
3. **Column 3**: Quantity
4. **Column 4+**: Ignored (prices, etc.)

---

## ⚠️ Why CSV Works Better Than Excel

| Issue | Excel (.xlsx) | CSV (.csv) |
|-------|--------------|------------|
| **File Format** | Binary (ZIP archive) | Plain text |
| **Encoding** | Complex (XML, metadata) | Simple (UTF-8) |
| **Compatibility** | May fail on corrupted files | Always works |
| **File Size** | Larger (compressed) | Smaller (text only) |
| **Import Speed** | Slower (unzip + parse) | Faster (direct parse) |

**Recommendation:** Always use CSV for data import/export!

---

## 🔧 Alternative: Fix Excel File

If you MUST use Excel, try these fixes:

### Fix 1: Re-save Excel
1. Open Excel file
2. **File → Save As → Excel Workbook (*.xlsx)**
3. Save with new name
4. Try uploading again

### Fix 2: Remove Formatting
1. Select all data (Ctrl+A)
2. Copy (Ctrl+C)
3. Open new Excel workbook
4. Paste as **Values only** (Ctrl+Alt+V → Values)
5. Save as CSV

### Fix 3: Check for Hidden Data
1. Open Excel file
2. Press **Ctrl+End** to jump to last used cell
3. If it jumps far beyond your data → delete empty rows/columns
4. Save and try again

---

## 📝 CSV Export from Excel - Detailed Steps

### Windows Excel:

1. **File Menu** (top-left corner)
2. **Save As**
3. **Browse** to choose location
4. **File name**: Enter name (e.g., `products-import.csv`)
5. **Save as type**: Click dropdown
6. Scroll to find: **CSV (Comma delimited) (*.csv)**
7. Click **Save**
8. Warning popup → Click **Yes**

### Mac Excel:

1. **File → Save As**
2. Click **File Format** dropdown
3. Select **CSV UTF-8 (Comma-delimited) (.csv)**
4. Click **Save**

### Google Sheets:

1. **File → Download**
2. Select **Comma-separated values (.csv)**
3. File downloads automatically

---

## 🧪 Test Your CSV File

Before uploading to WMS, open the CSV in Notepad to verify:

**1. Open with Notepad:**
   - Right-click CSV file
   - **Open with → Notepad**

**2. Check content looks like this:**
```
ACBYCY 16/16,##E1200 ELP 0-1083 1083 M,0.083,3350.00
ACSR 185/32,##E1700 HES 3090-0 3090 M,3.090,12438.78
```

**3. Should NOT look like this:**
```
PK���E��yh�����[Content_Types].xml���
```

If you see weird characters → file is still Excel format, not CSV!

---

## 🎯 Quick Checklist

Before uploading to WMS:

- [ ] File extension is `.csv` (NOT `.xlsx` or `.xls`)
- [ ] File opens in Notepad and shows readable text
- [ ] First column has product codes (ACBYCY, ACSR, etc.)
- [ ] Second column has lot info (##E1200 ELP...)
- [ ] No binary/random characters visible
- [ ] File size is small (<1MB for typical imports)

---

## 🚀 After Saving as CSV

**1. Refresh WMS page** (Ctrl+Shift+R)

**2. Click "Import CSV/Excel"**

**3. Upload the NEW .csv file**

**4. You should see:**
   - ✅ Clean preview table
   - ✅ Proper column parsing
   - ✅ "IMPORT" button enabled

**5. Click "IMPORT"**

**6. Success!** 🎉

---

## ❓ Still Having Issues?

### Issue: "Missing required columns"
**Solution:** 
- Your CSV has no header row
- System will auto-detect and use column positions
- Just click "Import" anyway - it will work!

### Issue: "Failed to parse file"
**Solution:**
- File encoding issue
- Try saving as **CSV UTF-8** instead of plain CSV
- Or open in Notepad → Save As → Encoding: UTF-8

### Issue: "Preview shows wrong data"
**Solution:**
- Check delimiter (comma vs semicolon vs tab)
- Excel regional settings may use semicolon
- Save as **CSV (Comma delimited)** not **CSV (Semicolon delimited)**

---

## 📞 Summary

**Problem:** Excel file shows corrupted preview with random characters

**Root Cause:** Excel .xlsx is binary format (ZIP containing XML files)

**Solution:** Save Excel file as CSV format before uploading

**Steps:**
1. Open Excel file
2. File → Save As
3. Choose: **CSV (Comma delimited) (*.csv)**
4. Save
5. Upload new .csv file to WMS

**Result:** ✅ Clean import with proper data parsing!

---

**Pro Tip:** Always keep a CSV export of your product data for quick imports! 💡
