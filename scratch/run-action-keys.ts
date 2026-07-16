// One-off, read-only: samples the action-map vocabulary in Snapshot.data to validate the
// extraction constants in lib/metrics/extract.ts. Run with: pnpm dlx tsx scratch/run-action-keys.ts
import { configDotenv } from "dotenv";
import { Client } from "pg";

configDotenv({ path: ".env.local" });

const q = {
    actionsKeys: `SELECT key, COUNT(*) AS days_present, SUM((s.data->'actions'->>key)::numeric) AS total_count
        FROM "Snapshot" s CROSS JOIN LATERAL jsonb_object_keys(s.data->'actions') AS key
        WHERE jsonb_typeof(s.data->'actions') = 'object'
        GROUP BY key ORDER BY days_present DESC, total_count DESC`,
    actionValuesKeys: `SELECT key, COUNT(*) AS days_present, SUM((s.data->'actionValues'->>key)::numeric) AS total_value
        FROM "Snapshot" s CROSS JOIN LATERAL jsonb_object_keys(s.data->'actionValues') AS key
        WHERE jsonb_typeof(s.data->'actionValues') = 'object'
        GROUP BY key ORDER BY days_present DESC, total_value DESC`,
    purchaseValueRows: `SELECT s.ad_account_id, s.data->>'date' AS day, s.data->>'purchaseValue' AS scalar_purchase_value,
        s.data->'actionValues' AS action_values, s.data->>'conversions' AS scalar_conversions
        FROM "Snapshot" s WHERE (s.data->>'purchaseValue')::numeric > 0
        ORDER BY s.ad_account_id, day LIMIT 20`,
    linkClickCoverage: `SELECT
        COUNT(*) FILTER (WHERE jsonb_typeof(s.data->'actions') = 'object' AND s.data->'actions' ? 'link_click') AS with_link_click,
        COUNT(*) FILTER (WHERE jsonb_typeof(s.data->'actions') = 'object') AS with_actions,
        COUNT(*) AS total FROM "Snapshot" s`,
    crossCheck: `SELECT s.ad_account_id, a.external_id,
        SUM((s.data->>'clicks')::numeric) AS all_clicks,
        SUM(COALESCE((s.data->'actions'->>'link_click')::numeric,0)) AS link_clicks,
        SUM(COALESCE((s.data->'actions'->>'lead')::numeric,0)) AS lead_rollup,
        SUM(COALESCE((s.data->'actions'->>'fb_pixel_lead')::numeric,0)) AS bare_pixel_lead,
        SUM(COALESCE((s.data->'actions'->>'offsite_conversion.fb_pixel_lead')::numeric,0)) AS prefixed_pixel_lead,
        SUM((s.data->>'spend')::numeric) AS spend
        FROM "Snapshot" s JOIN "AdAccount" a ON a.id = s.ad_account_id
        GROUP BY s.ad_account_id, a.external_id ORDER BY link_clicks DESC LIMIT 25`,
};

async function main() {
    const client = new Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        for (const [name, sql] of Object.entries(q)) {
            const { rows } = await client.query(sql);
            console.log(`\n===== ${name} (${rows.length} rows) =====`);
            console.table(rows);
        }
    } finally {
        await client.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
