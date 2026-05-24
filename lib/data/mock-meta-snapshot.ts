export function mockMetaSnapshot(start: Date) {
    const end = new Date();
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    // Daily baselines with light randomization, then scaled by period length
    const dailyImpressions = 45_000 + Math.floor(Math.random() * 15_000);
    const dailySpend = 320 + Math.random() * 120;

    const impressions = dailyImpressions * days;
    const reach = Math.floor(impressions * 0.42);
    const frequency = impressions / reach;
    const spend = dailySpend * days;

    const clicks = Math.floor(impressions * 0.0185); // ~1.85% CTR
    const uniqueClicks = Math.floor(clicks * 0.78);
    const inlineLinkClicks = Math.floor(clicks * 0.72);

    const ctr = (clicks / impressions) * 100;
    const uniqueCtr = (uniqueClicks / reach) * 100;
    const cpc = spend / clicks;
    const cpm = (spend / impressions) * 1000;
    const cpp = (spend / reach) * 1000;

    // Funnel actions
    const pageEngagement = Math.floor(clicks * 1.3);
    const postEngagement = Math.floor(clicks * 1.25);
    const landingPageView = Math.floor(inlineLinkClicks * 0.85);
    const viewContent = Math.floor(landingPageView * 0.7);
    const addToCart = Math.floor(viewContent * 0.15);
    const initiateCheckout = Math.floor(addToCart * 0.55);
    const purchase = Math.max(1, Math.floor(initiateCheckout * 0.42));
    const purchaseValue = purchase * (47 + Math.random() * 25);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    return {
        data: [
            {
                account_id: "act_178492035716284",
                account_name: "Acme Co. Ads",
                account_currency: "EUR",
                date_start: fmt(start),
                date_stop: fmt(end),
                impressions: impressions.toString(),
                reach: reach.toString(),
                frequency: frequency.toFixed(6),
                clicks: clicks.toString(),
                unique_clicks: uniqueClicks.toString(),
                inline_link_clicks: inlineLinkClicks.toString(),
                inline_link_click_ctr: ((inlineLinkClicks / impressions) * 100).toFixed(6),
                ctr: ctr.toFixed(6),
                unique_ctr: uniqueCtr.toFixed(6),
                cpc: cpc.toFixed(6),
                cpm: cpm.toFixed(6),
                cpp: cpp.toFixed(6),
                cost_per_inline_link_click: (spend / inlineLinkClicks).toFixed(6),
                cost_per_unique_click: (spend / uniqueClicks).toFixed(6),
                spend: spend.toFixed(2),
                social_spend: "0",
                objective: "OUTCOME_SALES",
                buying_type: "AUCTION",
                actions: [
                    { action_type: "link_click", value: inlineLinkClicks.toString() },
                    { action_type: "page_engagement", value: pageEngagement.toString() },
                    { action_type: "post_engagement", value: postEngagement.toString() },
                    { action_type: "post_reaction", value: Math.floor(postEngagement * 0.18).toString() },
                    { action_type: "comment", value: Math.floor(postEngagement * 0.03).toString() },
                    { action_type: "post", value: Math.floor(postEngagement * 0.008).toString() },
                    { action_type: "landing_page_view", value: landingPageView.toString() },
                    { action_type: "offsite_conversion.fb_pixel_view_content", value: viewContent.toString() },
                    { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: addToCart.toString() },
                    {
                        action_type: "offsite_conversion.fb_pixel_initiate_checkout",
                        value: initiateCheckout.toString(),
                    },
                    { action_type: "offsite_conversion.fb_pixel_purchase", value: purchase.toString() },
                    { action_type: "purchase", value: purchase.toString() },
                    { action_type: "omni_purchase", value: purchase.toString() },
                ],
                action_values: [
                    { action_type: "offsite_conversion.fb_pixel_purchase", value: purchaseValue.toFixed(2) },
                    { action_type: "purchase", value: purchaseValue.toFixed(2) },
                    { action_type: "omni_purchase", value: purchaseValue.toFixed(2) },
                ],
                cost_per_action_type: [
                    { action_type: "link_click", value: (spend / inlineLinkClicks).toFixed(6) },
                    { action_type: "landing_page_view", value: (spend / landingPageView).toFixed(6) },
                    { action_type: "offsite_conversion.fb_pixel_purchase", value: (spend / purchase).toFixed(6) },
                    { action_type: "purchase", value: (spend / purchase).toFixed(6) },
                ],
                purchase_roas: [
                    { action_type: "omni_purchase", value: (purchaseValue / spend).toFixed(6) },
                    { action_type: "offsite_conversion.fb_pixel_purchase", value: (purchaseValue / spend).toFixed(6) },
                ],
                website_purchase_roas: [
                    { action_type: "offsite_conversion.fb_pixel_purchase", value: (purchaseValue / spend).toFixed(6) },
                ],
            },
        ],
        paging: {
            cursors: {
                before: "MAZDZD",
                after: "MAZDZD",
            },
        },
    };
}
