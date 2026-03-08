import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
const getDataSourceRegistry = () => {
    // Process.env applies automatically in Next.js backend routes
    const dataSourceType = process.env.DATA_SOURCE || 'CSV';
    // Path maps relative to project root during runtime
    const csvPath = path.join(process.cwd(), 'data', 'sales_data.csv');

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


export async function GET(request) {
    try {
        const dataSource = getDataSourceRegistry();
        const data = await dataSource.getSalesData();
        return NextResponse.json(data);
    } catch (err) {
        console.error('Error fetching sales data:', err);
        return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
    }
}
