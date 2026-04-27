import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

async function generateTemplate() {
    const dir = path.join(process.cwd(), 'templates');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, 'Template.xlsx');
    if (fs.existsSync(filePath)) {
        console.log('Template already exists.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PEDIDO');

    // Add some labels just to make it look like a template
    worksheet.getCell('N1').value = 'NÚMERO PEDIDO';
    worksheet.getCell('N2').value = '';
    
    worksheet.getCell('AA1').value = 'USUÁRIO';
    worksheet.getCell('AA2').value = '';

    worksheet.getCell('AN1').value = 'DATA';
    worksheet.getCell('AN2').value = '';

    await workbook.xlsx.writeFile(filePath);
    console.log('Template created at', filePath);
}

generateTemplate();
