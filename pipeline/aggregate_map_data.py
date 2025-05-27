import json
import os
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

def process_article_entities(ner_list):
    """Entity processing for a single article."""
    location_entities = []
    other_entities = []
    
    if not isinstance(ner_list, list):
        return location_entities, other_entities
    

    location_names = []
    
    for entity in ner_list:
        if not isinstance(entity, dict):
            continue
            
        entity_name = entity.get("entity", "")
        entity_label = entity.get("label", "")
        
        if entity_label == "LOC":
            location_names.append(entity_name)
        elif entity_label in ["PER", "ORG"]:
            clean_name = entity_name.strip()
            if clean_name and len(clean_name) > 1:
                other_entities.append(clean_name)
    
    for location_name in location_names:
        country_code = get_country_code_for_location(location_name)
        if country_code:
            if isinstance(country_code, tuple):
                list(country_code).map(lambda code: location_entities.append((code, location_name)))
            else:
                location_entities.append((country_code, location_name))
    
    return location_entities, other_entities

# --- Main Processing Function ---


def process_files_for_range(time_range_str: str):
    """
    Aggregates NER data into an import and export metric for each country.
    
    Args:
        time_range_str: The time range to process.
    Returns:
        A dictionary containing the import and export data for each country, as well as the top entities for each country.
    """
    dates = get_dates_for_range(time_range_str)
    import_counts = defaultdict(int)
    export_counts = defaultdict(int)
    total_imports = 0
    total_exports = 0
    
    # Track entities relevant to each country
    country_related_entities = defaultdict(Counter)

    # Load providers once
    provider_country_map = load_providers_map()
    if not provider_country_map:
        return {"importData": {}, "exportData": {}, "countryEntities": {}}

    # Process statistics
    print(f"Processing data for {time_range_str} ({len(dates)} dates)...")
    processed_article_count = 0
    skipped_articles_no_country = 0

    for date_str in dates:
        articles_file_path = os.path.join(DATA_ROOT_DIR, date_str, "articles.json")
        if not os.path.exists(articles_file_path):
            continue

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
                    for entity in other_entities:
                        entity_counter[entity] += 1

        except (json.JSONDecodeError, Exception) as e:
            print(f"ERROR processing {articles_file_path}: {e}")

    print(f"Finished processing. Total articles: {processed_article_count}")
    if skipped_articles_no_country > 0:
        print(f"Warning: Skipped {skipped_articles_no_country} articles due to unknown provider country.")
    print(f"Total imports: {total_imports}, Total exports: {total_exports}")

    # Normalize data depending on the total number of imports and exports
    if total_imports > 0:
        normalized_import_data = {country: count / total_imports for country, count in import_counts.items()}
    else:
        normalized_import_data = {}
        
    if total_exports > 0:
        normalized_export_data = {country: count / total_exports for country, count in export_counts.items()}
    else:
        normalized_export_data = {}

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

    # Ensure all countries are present
    all_codes = set(COUNTRY_CODE_TO_NAME.keys())
    final_import = {code: normalized_import_data.get(code, 0) for code in all_codes}
    final_export = {code: normalized_export_data.get(code, 0) for code in all_codes}

    return {
        "importData": final_import, 
        "exportData": final_export,
        "countryEntities": country_top_entities
    }

# --- Main Execution ---

def main():
    """Runs the aggregation for all time ranges and saves the results."""
    time_ranges = ["today", "7days", "30days"]
    
    print(f"Output directory set to: {OUTPUT_DIR}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for tr_str in time_ranges:
        print(f"\n--- Aggregating data for: {tr_str} ---")
        aggregated_data = process_files_for_range(tr_str)
        output_file_path = os.path.join(OUTPUT_DIR, f"map_data_{tr_str}.json")
        
        try:
            with open(output_file_path, 'w', encoding='utf-8') as f:
                json.dump(aggregated_data, f, indent=2)
            print(f"Successfully wrote aggregated data to {output_file_path}")
        except Exception as e:
            print(f"ERROR: Failed to write output file {output_file_path}: {e}")

if __name__ == "__main__":
    print("Starting optimized map data aggregation...")
    main()
    print("\nMap data aggregation finished.")