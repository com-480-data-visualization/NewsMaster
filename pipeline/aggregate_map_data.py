import json
import os
import re
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import pycountry
import geonamescache

# --- Configuration & Mappings ---

gc = geonamescache.GeonamesCache()
gc_countries = gc.get_countries()
gc_countries_by_names = gc.get_countries_by_names()
gc_cities = gc.get_cities()


COUNTRY_CODE_TO_NAME = {country.alpha_3: country.name for country in pycountry.countries}
NAME_TO_CODE = {name.lower(): code for code, name in COUNTRY_CODE_TO_NAME.items()}


COUNTRY_NAME_TO_ISO3 = {}
COUNTRY_ISO2_TO_ISO3 = {}

# Pre-build country lookup maps 
for country in pycountry.countries:
    if hasattr(country, 'alpha_3') and hasattr(country, 'alpha_2'):
        COUNTRY_ISO2_TO_ISO3[country.alpha_2] = country.alpha_3
        COUNTRY_NAME_TO_ISO3[country.name.lower()] = country.alpha_3
        # Add common name variants
        if hasattr(country, 'common_name'):
            COUNTRY_NAME_TO_ISO3[country.common_name.lower()] = country.alpha_3
        if hasattr(country, 'official_name'):
            COUNTRY_NAME_TO_ISO3[country.official_name.lower()] = country.alpha_3

# Add geonamescache country names to lookup
for country_id, country_info in gc_countries.items():
    country_name_lower = country_info['name'].lower()
    if country_id in COUNTRY_ISO2_TO_ISO3:
        COUNTRY_NAME_TO_ISO3[country_name_lower] = COUNTRY_ISO2_TO_ISO3[country_id]

# Add countries_by_names entries
for name, country_info in gc_countries_by_names.items():
    if isinstance(country_info, dict) and 'iso' in country_info:
        country_id = country_info['iso']
        if country_id in COUNTRY_ISO2_TO_ISO3:
            COUNTRY_NAME_TO_ISO3[name.lower()] = COUNTRY_ISO2_TO_ISO3[country_id]

# Pre-build city map 
CITY_TO_COUNTRY = {}
for city_id, city_info in gc_cities.items():
    city_name_lower = city_info['name'].lower()
    country_iso2 = city_info['countrycode']
    if country_iso2 in COUNTRY_ISO2_TO_ISO3:
        # Store the city with highest population for each name (many cities share names)
        if city_name_lower not in CITY_TO_COUNTRY or city_info.get('population', 0) > CITY_TO_COUNTRY[city_name_lower][1]:
            CITY_TO_COUNTRY[city_name_lower] = (COUNTRY_ISO2_TO_ISO3[country_iso2], city_info.get('population', 0))

# Convert to just country codes for final lookup
CITY_TO_COUNTRY = {city: country_pop[0] for city, country_pop in CITY_TO_COUNTRY.items()}

# Edge cases not handled by libraries
EUROPEAN_COUNTRIES = [
    "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", 
    "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", 
    "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE", "GBR", "CHE", "NOR",
    "ISL", "LIE", "MDA", "MKD", "MNE", "SRB", "ALB", "AND", "BLR", "BIH", 
    "UKR", "RUS"
]

CARIBBEAN_COUNTRIES = [
    "ATG", "BHS", "BRB", "CUB", "DMA", "DOM", "GRD", "HTI", "JAM", "KNA",
    "LCA", "VCT", "TTO", "PRI", "VIR"
]

# Dict of regions to their constituent countries
REGION_COUNTRIES = {
    "europe": EUROPEAN_COUNTRIES,
    "caribbean": CARIBBEAN_COUNTRIES,
}

# --- Paths ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)

DATA_ROOT_DIR = os.path.join(PROJECT_ROOT, "public","data")
PROVIDERS_FILE_PATH = os.path.join(DATA_ROOT_DIR, "providers.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "data", "world_map")

# --- Helper Functions ---

def get_dates_for_range(time_range_str: str) -> tuple[str, ...]:
    """Generates a tuple of date strings (DD.MM.YYYY) for the given range. Cached for reuse."""
    dates = []
    today = datetime.today()
    days_to_fetch = 0

    if time_range_str == 'today':
        days_to_fetch = 1
    elif time_range_str == '7days':
        days_to_fetch = 7
    elif time_range_str == '30days':
        days_to_fetch = 30
    else:
        return tuple()  # Invalid range

    for i in range(days_to_fetch):
        date = today - timedelta(days=i)
        dates.append(date.strftime("%d.%m.%Y"))
    return tuple(dates)


def get_country_code_for_location(location_name):
    """
    Country code lookup with caching and pre-built lookup tables.
    
    Args:
        location_name (str): Name of location (city, region, country, etc.)
        
    Returns:
        str, tuple, or None: The alpha-3 country code if found, tuple of codes for regions, None otherwise
    """
    if not location_name or not isinstance(location_name, str):
        return None
    
    location_name_lower = location_name.lower().strip()
    
    # 0. Check if it's a known region 
    if location_name_lower in REGION_COUNTRIES:
        return tuple(REGION_COUNTRIES[location_name_lower])
    
    # 1. Direct country name lookup (pre-built hash table)
    if location_name_lower in COUNTRY_NAME_TO_ISO3:
        return COUNTRY_NAME_TO_ISO3[location_name_lower]
    
    # 2. City lookup (pre-built hash table)
    if location_name_lower in CITY_TO_COUNTRY:
        return CITY_TO_COUNTRY[location_name_lower]
    
    # 3. Try pycountry's fuzzy search 
    try:
        country = pycountry.countries.search_fuzzy(location_name)[0]
        return country.alpha_3
    except (LookupError, IndexError):
        pass
    
    # If no match is found
    return None

def load_providers_map():
    """Load and cache provider to country mapping."""
    try:
        with open(PROVIDERS_FILE_PATH, 'r', encoding='utf-8') as f:
            providers_data = json.load(f)
        print(f"Loaded {len(providers_data)} providers from {PROVIDERS_FILE_PATH}")
    except (FileNotFoundError, json.JSONDecodeError, Exception) as e:
        print(f"ERROR loading providers.json: {e}")
        return {}

    provider_country_map = {}
    for p in providers_data:
        provider_id = p.get("id")
        provider_country = p.get("country")
        if provider_id and provider_country and isinstance(provider_country, str):
            provider_country_map[provider_id.lower()] = provider_country

    print(f"Processed provider map: {len(provider_country_map)} entries")
    return provider_country_map

def sanitize_entity_name(entity: str) -> str:
    """Sanitize entity name for use in filenames."""
    return re.sub(r'[^a-z0-9]', '_', entity.lower())

def check_article_mentions_entity(ner_list, target_entity: str) -> bool:
    """Check if an article mentions the target entity."""
    if not isinstance(ner_list, list):
        return False
    
    target_entity_lower = target_entity.lower()
    
    for entity in ner_list:
        if not isinstance(entity, dict):
            continue
            
        entity_name = entity.get("entity", "").lower()
        entity_label = entity.get("label", "")
        
        # Check if the entity matches our target entity
        # We look for exact matches or partial matches for multi-word entities
        if (entity_label in ["PER", "ORG", "MISC"] and 
            (entity_name == target_entity_lower or 
             target_entity_lower in entity_name or 
             entity_name in target_entity_lower)):
            return True
    
    return False

def process_article_entities(ner_list):
    """Entity processing for a single article."""
    location_entities = []
    other_entities = []
    
    if not isinstance(ner_list, list):
        return location_entities, other_entities

    for entity in ner_list:
        if not isinstance(entity, dict):
            continue
            
        entity_name = entity.get("entity", "")
        entity_label = entity.get("label", "")
        
        if not entity_name:
            continue
            
        if entity_label == "LOC":
            country_code = get_country_code_for_location(entity_name)
            if country_code:
                if isinstance(country_code, str):
                    location_entities.append((country_code, entity_name))
                elif isinstance(country_code, tuple):
                    for code in country_code:
                        location_entities.append((code, entity_name))
        elif entity_label in ["PER", "ORG", "MISC"]:
            other_entities.append(entity_name)
    
    return location_entities, other_entities

def process_article_entities_locations_only(ner_list):
    """
    Process NER list and return only location entities with their country codes.
    
    Args:
        ner_list: List of NER entities from article
        
    Returns:
        List of tuples (country_code, entity_name) for location entities
    """
    location_entities = []
    
    if not isinstance(ner_list, list):
        return location_entities

    for entity in ner_list:
        if not isinstance(entity, dict):
            continue
            
        entity_name = entity.get("entity", "")
        entity_label = entity.get("label", "")
        
        if not entity_name or entity_label != "LOC":
            continue
            
        country_code = get_country_code_for_location(entity_name)
        if country_code:
            if isinstance(country_code, str):
                location_entities.append((country_code, entity_name))
            elif isinstance(country_code, tuple):
                for code in country_code:
                    location_entities.append((code, entity_name))
    
    return location_entities

def process_single_date(date_str: str):
    """
    Process articles for a single date and return aggregated data.
    
    Args:
        date_str: Date string in DD.MM.YYYY format
        
    Returns:
        Dictionary containing importData, exportData, nerData, TopEntitiesByCountry, topNer
    """
    import_counts = defaultdict(int)
    export_counts = defaultdict(int)
    total_imports = 0
    total_exports = 0
    
    # Track entities relevant to each country
    country_related_entities = defaultdict(Counter)
    
    # Track all NER entities for the day
    global_ner_counter = Counter()
    
    # Track NER entities by country
    country_ner_entities = defaultdict(Counter)

    # Load providers once
    provider_country_map = load_providers_map()
    if not provider_country_map:
        return {
            "importData": {},
            "exportData": {},
            "nerData": {},
            "TopEntitiesByCountry": {},
            "topNer": ""
        }

    articles_file_path = os.path.join(DATA_ROOT_DIR, date_str, "articles.json")
    if not os.path.exists(articles_file_path):
        print(f"No data file for {date_str}")
        return {
            "importData": {},
            "exportData": {},
            "nerData": {},
            "TopEntitiesByCountry": {},
            "topNer": ""
        }

    print(f"Processing data for {date_str}...")
    processed_article_count = 0
    skipped_articles_no_country = 0

    try:
        with open(articles_file_path, 'r', encoding='utf-8') as f:
            daily_data = json.load(f)

        articles = daily_data.get("data", [])

        for article in articles:
            processed_article_count += 1
            source_provider_id = article.get("providerId", "").lower()
            source_country_code = provider_country_map.get(source_provider_id)

            if not source_country_code:
                skipped_articles_no_country += 1
                continue

            ner_list = article.get("ner", [])
            location_entities, other_entities = process_article_entities(ner_list)
            
            # Skip if no countries are mentioned
            if not location_entities:
                continue
            
            # Get unique country codes
            mentioned_country_codes = {loc[0] for loc in location_entities}
            
            # Process imports and exports
            for mentioned_code in mentioned_country_codes:
                if mentioned_code != source_country_code:
                    import_counts[mentioned_code] += 1
                    total_imports += 1
                    export_counts[source_country_code] += 1
                    total_exports += 1
            
            # Associate entities with countries
            for country_code in mentioned_country_codes:
                entity_counter = country_related_entities[country_code]
                ner_counter = country_ner_entities[country_code]
                for entity in other_entities:
                    entity_counter[entity] += 1
                    ner_counter[entity] += 1
                    global_ner_counter[entity] += 1

    except (json.JSONDecodeError, Exception) as e:
        print(f"ERROR processing {articles_file_path}: {e}")

    print(f"Processed {processed_article_count} articles for {date_str}")
    if skipped_articles_no_country > 0:
        print(f"Warning: Skipped {skipped_articles_no_country} articles due to unknown provider country.")

    # Normalize data
    all_codes = set(COUNTRY_CODE_TO_NAME.keys())
    
    if total_imports > 0:
        normalized_import_data = {code: import_counts.get(code, 0) / total_imports for code in all_codes}
    else:
        normalized_import_data = {code: 0 for code in all_codes}
        
    if total_exports > 0:
        normalized_export_data = {code: export_counts.get(code, 0) / total_exports for code in all_codes}
    else:
        normalized_export_data = {code: 0 for code in all_codes}

    # Process top entities for each country
    country_top_entities = {}
    for country, entity_counter in country_related_entities.items():
        top_10 = entity_counter.most_common(10)
        
        if top_10:
            total_count = sum(count for _, count in top_10)
            
            if total_count > 0:
                formatted_top_10 = [
                    {
                        "entity": entity,
                        "count": count,
                        "share": count / total_count
                    }
                    for entity, count in top_10
                ]
                country_top_entities[country] = formatted_top_10

    # Get top global NER entity first
    top_ner = ""
    if global_ner_counter:
        top_ner = global_ner_counter.most_common(1)[0][0]

    # Process NER data - how much each country talks about the top NER entity
    ner_data = {}
    if top_ner:
        # Count how much each country mentions the top NER entity
        top_ner_by_country = {}
        total_top_ner_mentions = 0
        
        for country_code in all_codes:
            if country_code in country_ner_entities:
                count = country_ner_entities[country_code].get(top_ner, 0)
                top_ner_by_country[country_code] = count
                total_top_ner_mentions += count
            else:
                top_ner_by_country[country_code] = 0
        
        # Normalize the counts
        if total_top_ner_mentions > 0:
            ner_data = {code: count / total_top_ner_mentions for code, count in top_ner_by_country.items()}
        else:
            ner_data = {code: 0 for code in all_codes}
    else:
        # No top NER entity, set all to 0
        ner_data = {code: 0 for code in all_codes}

    return {
        "importData": normalized_import_data,
        "exportData": normalized_export_data,
        "nerData": ner_data,
        "TopEntitiesByCountry": country_top_entities,
        "topNer": top_ner
    }

# --- Main Execution Functions ---

def main():
    """Runs the aggregation for all dates and saves the results in daily files."""
    # Get dates for the last 30 days to include all recent data
    time_ranges = ["today", "7days", "30days"]
    all_dates = set()
    
    # Collect all unique dates from all time ranges
    for tr_str in time_ranges:
        dates = get_dates_for_range(tr_str)
        all_dates.update(dates)
    
    print(f"Output directory set to: {OUTPUT_DIR}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Process each date individually
    for date_str in sorted(all_dates, reverse=True):  # Most recent first
        print(f"\n--- Processing date: {date_str} ---")
        
        # Convert DD.MM.YYYY to YYYY-MM-DD for filename
        day, month, year = date_str.split('.')
        file_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        
        # Process this date
        date_data = process_single_date(date_str)
        
        # Filter out 0 values to reduce file size
        filtered_data = {
            "importData": {k: v for k, v in date_data["importData"].items() if v > 0},
            "exportData": {k: v for k, v in date_data["exportData"].items() if v > 0},
            "nerData": {k: v for k, v in date_data["nerData"].items() if v > 0},
            "TopEntitiesByCountry": date_data["TopEntitiesByCountry"],  # Keep as is
            "topNer": date_data["topNer"]  # Keep as is
        }
        
        # Save this date's data to its own file
        output_file_path = os.path.join(OUTPUT_DIR, f"map_{file_date}.json")
        
        try:
            with open(output_file_path, 'w', encoding='utf-8') as f:
                json.dump(filtered_data, f, indent=2)
            print(f"Successfully wrote {file_date} data to {output_file_path}")
            
            # Show file size for monitoring
            file_size = os.path.getsize(output_file_path)
            if file_size > 1024:
                print(f"File size: {file_size // 1024}KB")
            else:
                print(f"File size: {file_size}B")
                
        except Exception as e:
            print(f"ERROR: Failed to write output file {output_file_path}: {e}")
    
    print(f"\nTotal days processed: {len(all_dates)}")
    print("Daily files created successfully!")

def aggregate_ner_data():
    """This function is kept for compatibility but now calls the main function."""
    print("NER data is now included in the main aggregation process.")
    pass

# Function for compatibility with main pipeline
def aggregate_map_data():
    """Wrapper function to be called from the main pipeline."""
    main()

if __name__ == "__main__":
    print("Starting consolidated map data aggregation...")
    main()
    print("\nMap data aggregation finished.")