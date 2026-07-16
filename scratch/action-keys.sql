-- Read-only validation of the action-map vocabulary stored in Snapshot.data (jsonb).
-- Run each block in the Supabase SQL editor and compare against lib/metrics/extract.ts:
-- the PURCHASES/LEADS/LINK_CLICKS priority lists should be pruned to the keys that actually occur.
-- Safe to delete this file afterwards — it is not part of the app.

-- 1) Every distinct `actions` key: coverage (days present) and magnitude.
--    Expect keys like: lead / fb_pixel_lead / offsite_conversion.fb_pixel_lead / link_click / ...
SELECT key,
       COUNT(*)                                    AS days_present,
       SUM((s.data->'actions'->>key)::numeric)     AS total_count
FROM "Snapshot" s
CROSS JOIN LATERAL jsonb_object_keys(s.data->'actions') AS key
WHERE jsonb_typeof(s.data->'actions') = 'object'
GROUP BY key
ORDER BY days_present DESC, total_count DESC;

-- 2) Same for `actionValues`.
SELECT key,
       COUNT(*)                                        AS days_present,
       SUM((s.data->'actionValues'->>key)::numeric)    AS total_value
FROM "Snapshot" s
CROSS JOIN LATERAL jsonb_object_keys(s.data->'actionValues') AS key
WHERE jsonb_typeof(s.data->'actionValues') = 'object'
GROUP BY key
ORDER BY days_present DESC, total_value DESC;

-- 3) The fake-ROAS smoking gun: rows where Zernio's purchaseValue scalar claims revenue.
--    Inspect the maps — per the analysis these are lead values, and the new extraction must
--    yield revenue = null for them (no purchase key in actionValues).
SELECT s.ad_account_id,
       s.data->>'date'          AS day,
       s.data->>'purchaseValue' AS scalar_purchase_value,
       s.data->'actionValues'   AS action_values,
       s.data->>'conversions'   AS scalar_conversions,
       s.data->'actions'        AS actions
FROM "Snapshot" s
WHERE (s.data->>'purchaseValue')::numeric > 0
ORDER BY s.ad_account_id, day
LIMIT 50;

-- 4) link_click coverage — decides whether CLICK_BASIS = "link" is viable.
SELECT COUNT(*) FILTER (WHERE jsonb_typeof(s.data->'actions') = 'object'
                          AND s.data->'actions' ? 'link_click')            AS days_with_link_click,
       COUNT(*) FILTER (WHERE jsonb_typeof(s.data->'actions') = 'object')  AS days_with_actions,
       COUNT(*)                                                            AS days_total
FROM "Snapshot" s;

-- 5) Cross-check against the analysis numbers (accounts "506" and "508": link clicks should come
--    out at 19 vs 29 all-clicks and 2117 vs 3263). The literal ids in the analysis may be internal
--    Snapshot.ad_account_id values or fragments of AdAccount.external_id — try the join variant
--    below if the direct filter returns nothing.
SELECT s.ad_account_id,
       a.external_id,
       SUM((s.data->>'spend')::numeric)                                             AS spend,
       SUM((s.data->>'clicks')::numeric)                                            AS all_clicks,
       SUM(COALESCE((s.data->'actions'->>'link_click')::numeric, 0))                AS link_clicks,
       SUM(COALESCE((s.data->'actions'->>'lead')::numeric, 0))                      AS lead_rollup,
       SUM(COALESCE((s.data->'actions'->>'fb_pixel_lead')::numeric, 0))             AS bare_pixel_lead,
       SUM(COALESCE((s.data->'actions'->>'offsite_conversion.fb_pixel_lead')::numeric, 0)) AS prefixed_pixel_lead
FROM "Snapshot" s
JOIN "AdAccount" a ON a.id = s.ad_account_id
WHERE s.ad_account_id IN (506, 508)
   OR a.external_id LIKE '%506' OR a.external_id LIKE '%508'
GROUP BY s.ad_account_id, a.external_id
ORDER BY s.ad_account_id;
