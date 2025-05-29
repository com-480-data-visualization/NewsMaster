import os
import json
import feedparser
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone, date
import pytz
import time

# CET timezone
cet_tz = pytz.timezone("CET")

# Global counter for access denied responses
access_denied_count = 0

# Paths
PROVIDERS_JSON_PATH = 'public/data/providers.json'
OUTPUT_DIR = 'public/data'

def fetch_all_articles():
    print("Starting article fetching")
    print(f"Looking for providers in: {PROVIDERS_JSON_PATH}")
    global access_denied_count
    access_denied_count = 0

    try:
        print("Attempting to get providers...")
        providers = get_providers()
        if not providers:
            print("No providers found.")
            return []

        print(f"Found {len(providers)} providers")
        articles_items = fetch_and_deduplicate_articles(providers)
        if not articles_items:
            print("No new articles fetched.")
            print(f"Total access denied responses: {access_denied_count}")
            return []

        print(f"Fetched {len(articles_items)} articles.")
        print(f"Total access denied responses: {access_denied_count}")
        return articles_items

    except Exception as e:
        print(f"Error during article fetching: {e}")
        return []


def get_providers():
    try:
        with open(PROVIDERS_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            providers = [p for p in data if p.get('builtin') is True]
            print(f"Loaded {len(providers)} providers from file.")
            return providers
    except Exception as e:
        print(f"Failed to load providers: {e}")
        return []


def is_within_24_hours(timestamp):
    """Check if the given timestamp is within the last 24 hours."""
    current_time = time.time()
    time_difference = current_time - timestamp
    # 24 hours = 24 * 60 * 60 = 86400 seconds
    return time_difference <= 86400


def fetch_and_deduplicate_articles(providers):
    articles_items = []
    seen_urls = set()

    for provider in providers:
        provider_id = provider.get('id')
        urls = provider.get('url', [])
        if not urls or not provider_id:
            continue
        print(f"Processing provider {provider_id} with {len(urls)} urls.")

        for rss_url in urls:
            for item in fetch_rss(rss_url):
                url = item.get('link')
                title = item.get('title')
                if not url or not title:
                    continue

                if url in seen_urls:
                    continue

                pub_date = item.get('published', '')
                pub_timestamp = parse_pub_date(pub_date)
                
                # Skip articles that are not within the last 24 hours
                if not is_within_24_hours(pub_timestamp):
                    continue
                
                created_at = datetime.fromtimestamp(pub_timestamp, timezone.utc).isoformat(timespec='milliseconds') + 'Z'

                article = {
                    'id': generate_unique_key(url, title),
                    'providerId': provider_id,
                    'title': title,
                    'description': item.get('description', ''),
                    'url': url,
                    'language': provider.get('language', 'unknown'),
                    'createdAt': created_at,
                    'pubDate': pub_timestamp,
                }
                articles_items.append(article)
                seen_urls.add(url)

    print(f"Found {len(articles_items)} articles from today.")
    return articles_items


def fetch_rss(url):
    global access_denied_count
    try:
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml"}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code in (403, 404):
            access_denied_count += 1
            print(f"Access issue ({response.status_code}) on: {url}")
            return []
        response.raise_for_status()

        feed = feedparser.parse(response.content)
        return [{
            'title': entry.title,
            'description': clean_html(entry.get('summary', '')),
            'link': entry.link,
            'published': entry.get('published', '')
        } for entry in feed.entries]
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch RSS from {url} due to network issue: {e}")
        return []
    except Exception as e:
        print(f"Failed to fetch RSS from {url}: {e}")
        return []


def clean_html(html):
    return BeautifulSoup(html, 'html.parser').get_text(separator=' ', strip=True)


def generate_unique_key(url, title):
    return hashlib.md5(url.encode()).hexdigest()


def parse_pub_date(pub_date_str):
    try:
        if pub_date_str.endswith("GMT"):
            pub_date_str = pub_date_str.replace("GMT", "+0000")
        pub_date_obj = datetime.strptime(pub_date_str, "%a, %d %b %Y %H:%M:%S %z")
        pub_date_obj = pub_date_obj.astimezone(cet_tz)
    except Exception:
        try:
            pub_date_obj = datetime.strptime(pub_date_str, "%Y-%m-%d")
            pub_date_obj = cet_tz.localize(pub_date_obj)
        except Exception:
            pub_date_obj = datetime.now(cet_tz)
    return int(pub_date_obj.timestamp())


if __name__ == '__main__':
    print("Starting ingestor_clean.py directly for fetching...")
    fetched_articles = fetch_all_articles()
    if fetched_articles:
        print(f"Successfully fetched {len(fetched_articles)} articles (output not saved)." )
    else:
        print("Fetching completed, but no articles were returned.")

print("Ending ingestor_clean.py")