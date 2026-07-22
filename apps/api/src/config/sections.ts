export interface FeedSource {
  source: string;
  url: string;
}

export interface SectionConfig {
  id: string;
  title: string;
  focus: string;
  feeds: FeedSource[];
}

export const TIMEZONE = "Africa/Lagos";

// How far back a story may be dated and still make the brief.
export const MAX_STORY_AGE_HOURS = 36;
// Articles per section handed to the summarizer.
export const MAX_ITEMS_PER_SECTION = 16;

export const SECTIONS: SectionConfig[] = [
  {
    id: "politics",
    title: "Politics & National",
    focus:
      "Nigerian politics, government, policy, elections, security and major national news. Skip celebrity gossip, sports and product launches.",
    feeds: [
      { source: "Punch", url: "https://punchng.com/feed/" },
      { source: "Vanguard", url: "https://www.vanguardngr.com/feed/" },
      { source: "Premium Times", url: "https://www.premiumtimesng.com/feed" },
      { source: "Channels TV", url: "https://www.channelstv.com/feed/" },
      { source: "The Cable", url: "https://www.thecable.ng/feed/" },
      { source: "Daily Trust", url: "https://dailytrust.com/feed/" },
    ],
  },
  {
    id: "tech",
    title: "Tech",
    focus:
      "Nigerian and African technology: startups, funding, telecoms, fintech, regulation, and the global tech stories that matter to Nigeria.",
    feeds: [
      { source: "TechCabal", url: "https://techcabal.com/feed/" },
      { source: "Techpoint Africa", url: "https://techpoint.africa/feed/" },
      { source: "Benjamin Dada", url: "https://www.benjamindada.com/rss/" },
      { source: "Disrupt Africa", url: "https://disruptafrica.com/feed/" },
    ],
  },
  {
    id: "business",
    title: "Business & Economy",
    focus:
      "The Nigerian economy: naira, inflation, CBN policy, oil and gas, trade, and major company news.",
    feeds: [
      { source: "Nairametrics", url: "https://nairametrics.com/feed/" },
      { source: "BusinessDay", url: "https://businessday.ng/feed/" },
      {
        source: "Guardian Nigeria",
        url: "https://guardian.ng/category/business-services/feed/",
      },
    ],
  },
  {
    id: "markets",
    title: "Stock Market",
    focus:
      "The Nigerian Exchange (NGX): index moves, top gainers and losers, corporate results, dividends, and notable global market moves.",
    feeds: [
      {
        source: "Nairametrics Markets",
        url: "https://nairametrics.com/category/market-news/feed/",
      },
      {
        source: "BusinessDay Markets",
        url: "https://businessday.ng/category/markets/feed/",
      },
      {
        source: "Guardian Capital Market",
        url: "https://guardian.ng/category/business-services/capital-market/feed/",
      },
    ],
  },
  {
    id: "sports",
    title: "Sport",
    focus:
      "Nigerian sport first: Super Eagles, Super Falcons, Nigerian athletes abroad, NPFL, then the biggest global football and sports stories.",
    feeds: [
      { source: "Complete Sports", url: "https://www.completesports.com/feed/" },
      { source: "Soccernet NG", url: "https://www.soccernet.ng/feed/" },
      { source: "Own Goal Nigeria", url: "https://owngoalnigeria.com/feed/" },
      { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
    ],
  },
  {
    id: "world",
    title: "Around the World",
    focus:
      "The most consequential world news: major geopolitics, economies and events, with an eye for what matters to Africa.",
    feeds: [
      { source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
      { source: "France 24", url: "https://www.france24.com/en/rss" },
      { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all" },
    ],
  },
];
