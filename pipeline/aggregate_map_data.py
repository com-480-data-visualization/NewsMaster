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

def process_single_date(date_str: str, top_ner: str):
    """
    Process articles for a single date and return aggregated data.
    
    Args:
        date_str: Date string in DD.MM.YYYY format
        top_ner: Target entity to track
        
    Returns:
        Dictionary containing importData, exportData, nerData, TopEntitiesByCountry, topNer, foreignPressData
    """
    import_counts = defaultdict(int)
    export_counts = defaultdict(int)
    total_imports = 0
    total_exports = 0
    
    # Track articles per country to normalize by article volume
    articles_per_country = defaultdict(int)
    
    ner_counts = defaultdict(int)
    # Track entities relevant to each country
    country_related_entities = defaultdict(Counter)
    

    country_coverage_matrix = defaultdict(lambda: defaultdict(int))  
    country_covering_matrix = defaultdict(lambda: defaultdict(int))  

    # Load providers once
    provider_country_map = load_providers_map()
    if not provider_country_map:
        return {
            "importData": {},
            "exportData": {},
            "nerData": {},
            "TopEntitiesByCountry": {},
            "topNer": "",
            "foreignPressData": {
                "countryCoverage": {},
                "countryCovering": {},
                "featuredRankings": [],
                "coveringRankings": []
            }
        }

    articles_file_path = os.path.join(DATA_ROOT_DIR, date_str, "articles.json")
    if not os.path.exists(articles_file_path):
        print(f"No data file for {date_str}")
        return {
            "importData": {},
            "exportData": {},
            "nerData": {},
            "TopEntitiesByCountry": {},
            "topNer": "",
            "foreignPressData": {
                "countryCoverage": {},
                "countryCovering": {},
                "featuredRankings": [],
                "coveringRankings": []
            }
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

            # Track total articles per country
            articles_per_country[source_country_code] += 1

            ner_list = article.get("ner", [])
            location_entities, other_entities = process_article_entities(ner_list)
            

            # Count target entity mentions by source country
            for entity in other_entities:
                if entity == top_ner:
                    ner_counts[source_country_code] += 1
            for entity in location_entities:
                if entity[1] == top_ner:
                    ner_counts[entity[0]] += 1
                    
 
            
            # Get unique country codes mentioned in the article
            mentioned_country_codes = {loc[0] for loc in location_entities} if location_entities else set()
            
            # Skip import/export processing if no countries are mentioned
            if not location_entities:
                continue
            
            # Process imports and exports
            for mentioned_code in mentioned_country_codes:
                if mentioned_code != source_country_code:
                    import_counts[mentioned_code] += 1
                    total_imports += 1
                    export_counts[source_country_code] += 1
                    total_exports += 1
                    
                    country_coverage_matrix[mentioned_code][source_country_code] += 1
                    country_covering_matrix[source_country_code][mentioned_code] += 1
                    
            # Associate entities with countries
            for country_code in mentioned_country_codes:
                if country_code != source_country_code:
                    entity_counter = country_related_entities[country_code]
                    for entity in other_entities:
                        entity_counter[entity] += 1


    except (json.JSONDecodeError, Exception) as e:
        print(f"ERROR processing {articles_file_path}: {e}")

    print(f"Processed {processed_article_count} articles for {date_str}")
    if skipped_articles_no_country > 0:
        print(f"Warning: Skipped {skipped_articles_no_country} articles due to unknown provider country.")

    # Normalize data by articles per country instead of global totals
    all_codes = set(COUNTRY_CODE_TO_NAME.keys())
    
    # Minimum mention threshold to filter out noise
    MIN_MENTIONS = 2

    # Count providers per country for both export and NER normalization
    providers_per_country = defaultdict(set)
    for article in articles:
        source_provider_id = article.get("providerId", "").lower()
        source_country_code = provider_country_map.get(source_provider_id)
        if source_country_code:
            providers_per_country[source_country_code].add(source_provider_id)
    
    # Convert sets to counts
    providers_per_country = {code: len(providers) for code, providers in providers_per_country.items()}

    # For import data: normalize by total articles across all countries (since imports are received mentions)
    if total_imports > 0:
        normalized_import_data = {code: import_counts.get(code, 0) / total_imports for code in all_codes}
    else:
        normalized_import_data = {code: 0 for code in all_codes}
        
    # For export data: normalize by providers per source country (since exports are what each country mentions)
    # Then globally normalize to sum to 1
    export_ratios = {}
    for code in all_codes:
        export_count = export_counts.get(code, 0)
        provider_count = providers_per_country.get(code, 0)
        if provider_count > 0:
            # Export ratio = mentions made by this country / number of providers in this country
            export_ratios[code] = export_count / provider_count
        else:
            export_ratios[code] = 0
    
    # Globally normalize export ratios to sum to 1
    total_export_ratio = sum(export_ratios.values())
    if total_export_ratio > 0:
        normalized_export_data = {code: ratio / total_export_ratio for code, ratio in export_ratios.items()}
    else:
        normalized_export_data = {code: 0 for code in all_codes}

    # For NER data: normalize by number of providers per country
    # Then globally normalize to sum to 1
    ner_ratios = {}
    for code in all_codes:
        ner_count = ner_counts.get(code, 0)
        provider_count = providers_per_country.get(code, 0)
        if provider_count > 0 and ner_count >= MIN_MENTIONS:
            # NER ratio = entity mentions by this country / number of providers in this country
            ner_ratios[code] = ner_count / provider_count
        else:
            ner_ratios[code] = 0
    
    # Globally normalize NER ratios to sum to 1
    total_ner_ratio = sum(ner_ratios.values())
    if total_ner_ratio > 0:
        normalized_ner_data = {code: ratio / total_ner_ratio for code, ratio in ner_ratios.items()}
    else:
        normalized_ner_data = {code: 0 for code in all_codes}

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

    foreign_press_data = process_foreign_press_data(
        country_coverage_matrix, 
        country_covering_matrix, 
        providers_per_country,
        all_codes
    )

    return {
        "importData": normalized_import_data,
        "exportData": normalized_export_data,
        "nerData": normalized_ner_data,
        "TopEntitiesByCountry": country_top_entities,
        "topNer": top_ner,
        "foreignPressData": foreign_press_data
    }

def process_foreign_press_data(coverage_matrix, covering_matrix, providers_per_country, all_codes):
    """
    Process foreign press coverage data from country-to-country matrices.
    
    Args:
        coverage_matrix: Dict[featured_country][covering_country] = count
        covering_matrix: Dict[covering_country][featured_country] = count  
        providers_per_country: Dict[country] = provider_count
        all_codes: Set of all country codes
        
    Returns:
        Dict containing foreign press analysis data
    """

    country_coverage = {}  # How much each country is featured by others
    country_covering = {}  # How much each country covers others
    
    for country in all_codes:
        covered_by = {}
        total_coverage = 0
        
        # Get who covers this country and normalize by provider count
        if country in coverage_matrix:
            for covering_country, count in coverage_matrix[country].items():
                # Normalize by the covering country's provider count
                provider_count = providers_per_country.get(covering_country, 1)
                normalized_count = count / provider_count
                covered_by[covering_country] = normalized_count
                total_coverage += normalized_count
        
        # Store the unnormalized total_coverage for global ranking normalization
        original_total_coverage = total_coverage
        
        # Normalize coveredBy values to sum to 1 (100%) for this specific country
        if total_coverage > 0:
            for covering_country in covered_by:
                covered_by[covering_country] = covered_by[covering_country] / total_coverage
        
        country_coverage[country] = {
            "coveredBy": covered_by,
            "totalCoverage": original_total_coverage
        }
    
    for country in all_codes:
        covering = {}
        total_covering = 0
        
        # Get who this country covers and normalize by provider count
        if country in covering_matrix:
            provider_count = providers_per_country.get(country, 1)
            for covered_country, count in covering_matrix[country].items():
                # Normalize by this country's provider count
                normalized_count = count / provider_count
                covering[covered_country] = normalized_count
                total_covering += normalized_count
        
        # Store the unnormalized total_covering for global ranking normalization
        original_total_covering = total_covering
        
        if total_covering > 0:
            for covered_country in covering:
                covering[covered_country] = covering[covered_country] / total_covering
        
        country_covering[country] = {
            "covering": covering,
            "totalCovering": original_total_covering
        }
    

    total_featured_activity = sum(data["totalCoverage"] for data in country_coverage.values())
    if total_featured_activity > 0:
        for country_data in country_coverage.values():
            country_data["totalCoverage"] /= total_featured_activity
    
    total_covering_activity = sum(data["totalCovering"] for data in country_covering.values())
    if total_covering_activity > 0:
        for country_data in country_covering.values():
            country_data["totalCovering"] /= total_covering_activity
    
    featured_rankings = [
        {"countryCode": country, "totalCoverage": data["totalCoverage"]}
        for country, data in country_coverage.items()
        if data["totalCoverage"] > 0
    ]
    featured_rankings.sort(key=lambda x: x["totalCoverage"], reverse=True)
    
    covering_rankings = [
        {"countryCode": country, "totalCovering": data["totalCovering"]}
        for country, data in country_covering.items()
        if data["totalCovering"] > 0
    ]
    covering_rankings.sort(key=lambda x: x["totalCovering"], reverse=True)
    
    return {
        "countryCoverage": country_coverage,
        "countryCovering": country_covering, 
        "featuredRankings": featured_rankings,
        "coveringRankings": covering_rankings
    }

# --- Main Execution Functions ---

def main(top_ner: str, last_30_days: bool = False):
    """
    Runs the aggregation for dates and saves the results in daily files.
    
    Args:
        top_ner (str): The top NER entity to track
        last_30_days (bool): If True, process last 30 days. If False, process only today.
    """
    print(f"Output directory set to: {OUTPUT_DIR}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if last_30_days:
        # Generate list of dates for the last 30 days
        end_date = datetime.now()
        dates_to_process = []
        
        for i in range(30):
            date = end_date - timedelta(days=i)
            date_str = date.strftime("%d.%m.%Y")
            dates_to_process.append(date_str)
        
        print(f"Processing last 30 days: {len(dates_to_process)} dates")
    else:
        # Process only today
        today = datetime.now().strftime("%d.%m.%Y")
        dates_to_process = [today]
        print(f"Processing today only: {today}")

    processed_count = 0
    skipped_count = 0

    for date_str in dates_to_process:
        print(f"\n--- Processing {date_str} ---")
        
        # Check if data file exists for this date
        articles_file_path = os.path.join(DATA_ROOT_DIR, date_str, "articles.json")
        if not os.path.exists(articles_file_path):
            print(f"No data file for {date_str}, skipping...")
            skipped_count += 1
            continue
        
        # Process this date
        date_data = process_single_date(date_str, top_ner)
        
        # Filter out 0 values to reduce file size
        filtered_data = {
            "importData": {k: v for k, v in date_data["importData"].items() if v > 0},
            "exportData": {k: v for k, v in date_data["exportData"].items() if v > 0},
            "nerData": {k: v for k, v in date_data["nerData"].items() if v > 0},
            "TopEntitiesByCountry": date_data["TopEntitiesByCountry"],  
            "topNer": top_ner, 
            "foreignPressData": date_data["foreignPressData"]
        }
        
        # Convert DD.MM.YYYY to YYYY-MM-DD for filename
        day, month, year = date_str.split('.')
        file_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        
        # Save this date's data to its own file
        output_file_path = os.path.join(OUTPUT_DIR, f"map_{file_date}.json")
        
        try:
            with open(output_file_path, 'w', encoding='utf-8') as f:
                json.dump(filtered_data, f, indent=2)
            print(f"Successfully wrote {file_date} data to {output_file_path}")
            processed_count += 1
                
        except Exception as e:
            print(f"ERROR: Failed to write output file {output_file_path}: {e}")
            skipped_count += 1

    print(f"\n=== Summary ===")
    print(f"Total dates processed: {processed_count}")
    print(f"Total dates skipped: {skipped_count}")
    print("Daily files created successfully!")

def aggregate_ner_data():
    """This function is kept for compatibility but now calls the main function."""
    print("NER data is now included in the main aggregation process.")
    pass

# Function for compatibility with main pipeline
def aggregate_map_data():
    """Wrapper function to be called from the main pipeline."""
    main("Russia")

if __name__ == "__main__":
    print("Starting consolidated map data aggregation...")
    main("Donald Trump", last_30_days=True)  
  
    print("\nMap data aggregation finished.")