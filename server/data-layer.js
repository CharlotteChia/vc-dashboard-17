import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CSV DATA SOURCE ---
class CsvDataSource {
    constructor(filePath) {
        this.filePath = filePath;
    }

    async getSalesData() {
        return new Promise((resolve, reject) => {
            const results = [];
            if (!fs.existsSync(this.filePath)) {
                return reject(new Error('Sales data file not found'));
            }

            fs.createReadStream(this.filePath)
                .pipe(csv({
                    mapValues: ({ header, value }) => {
                        const numHeaders = ['orders', 'revenue', 'cost', 'visitors', 'customers'];
                        if (numHeaders.includes(header.toLowerCase())) return Number(value) || 0;
                        return value;
                    }
                }))
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', (err) => reject(err));
        });
    }
}

// --- SUPABASE DATA SOURCE ---
class SupabaseDataSource {
    constructor(url, key) {
        this.supabase = createClient(url, key);
    }

    async getSalesData() {
        const { data, error } = await this.supabase
            .from('sales_data')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;
        return data;
    }
}

// --- DATA SOURCE FACTORY ---
export const getDataSourceRegistry = () => {
    const dataSourceType = process.env.DATA_SOURCE || 'CSV';
    const csvPath = path.join(__dirname, '..', 'data', 'sales_data.csv');

    if (dataSourceType.toUpperCase() === 'SUPABASE') {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            console.warn('Supabase credentials missing, falling back to CSV');
            return new CsvDataSource(csvPath);
        }

        return new SupabaseDataSource(url, key);
    }

    return new CsvDataSource(csvPath);
};
