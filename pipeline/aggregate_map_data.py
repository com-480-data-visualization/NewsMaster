import json
import os
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import pycountry
import geonamescache
import random

# --- Configuration & Mappings ---

# Initialize geonamescache
gc = geonamescache.GeonamesCache()
gc_countries = gc.get_countries()
gc_countries_by_names = gc.get_countries_by_names()
gc_cities = gc.get_cities()

# Generate country mappings dynamically using pycountry
COUNTRY_CODE_TO_NAME = {country.alpha_3: country.name for country in pycountry.countries}
NAME_TO_CODE = {name.lower(): code for code, name in COUNTRY_CODE_TO_NAME.items()}

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

# --- Paths --- (Adjust relative paths based on where this script is run from)
# Assuming this script is in pipeline/ and data is in ../data/, public in ../public/
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR) # Assumes pipeline is one level down from root

DATA_ROOT_DIR = os.path.join(PROJECT_ROOT, "data")
PROVIDERS_FILE_PATH = os.path.join(DATA_ROOT_DIR, "providers.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "data/world_map") # Output to public/data

# --- Helper Functions ---

def get_dates_for_range(time_range_str: str) -> list[str]:
    """Generates a list of date strings (DD.MM.YYYY) for the given range."""
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
        return [] # Invalid range

    for i in range(days_to_fetch):
        date = today - timedelta(days=i)
        dates.append(date.strftime("%d.%m.%Y"))
    return dates

def get_country_code_for_location(location_name):
    """
    Get the ISO 3166-1 alpha-3 country code for a location using geonamescache
    and pycountry libraries. For special regions, returns a list of country codes.
    
    Args:
        location_name (str): Name of location (city, region, country, etc.)
        
    Returns:
        str, list, or None: The alpha-3 country code if found, list of codes for regions, None otherwise
    """
    if not location_name or not isinstance(location_name, str):
        return None
    
    location_name_lower = location_name.lower().strip()
    
    # 0. Check if it's a known region
    if location_name_lower in REGION_COUNTRIES:
        return REGION_COUNTRIES[location_name_lower]
    
    # 1. Check if it's a country name
    for country_id, country_info in gc_countries.items():
        if country_info['name'].lower() == location_name_lower:
            # Convert ISO2 to ISO3
            try:
                country = pycountry.countries.get(alpha_2=country_id)
                if country and hasattr(country, 'alpha_3'):
                    return country.alpha_3
            except (KeyError, AttributeError, LookupError):
                # Skip if we can't convert this country code
                pass
    
    # 2. Try to find by country name in countries_by_names
    for name, country_id in gc_countries_by_names.items():
        if name.lower() == location_name_lower:
            # Convert ISO2 to ISO3
            try:
                country = pycountry.countries.get(alpha_2=country_id)
                if country and hasattr(country, 'alpha_3'):
                    return country.alpha_3
            except (KeyError, AttributeError, LookupError):
                # Skip if we can't convert this country code
                pass
    
    # 3. Try pycountry's search (handles many languages and fuzzy matches)
    try:
        country = pycountry.countries.search_fuzzy(location_name)[0]
        return country.alpha_3
    except (LookupError, IndexError):
        pass
    
    # 4. Check if it's a known city in geonamescache
    # First try exact match
    for city_id, city_info in gc_cities.items():
        if city_info['name'].lower() == location_name_lower:
            country_iso2 = city_info['countrycode']
            try:
                country = pycountry.countries.get(alpha_2=country_iso2)
                if country and hasattr(country, 'alpha_3'):
                    return country.alpha_3
            except (KeyError, AttributeError, LookupError):
                # Skip if we can't convert this country code
                pass
    
    # 5. Try to search cities by name (partial match)
    try:
        city_matches = gc.search_cities(location_name, case_sensitive=False)
        if city_matches:
            # Take the city with the largest population
            largest_city = max(city_matches, key=lambda city: city.get('population', 0))
            country_iso2 = largest_city['countrycode']
            try:
                country = pycountry.countries.get(alpha_2=country_iso2)
                if country and hasattr(country, 'alpha_3'):
                    return country.alpha_3
            except (KeyError, AttributeError, LookupError):
                # Skip if we can't convert this country code
                pass
    except Exception:
        # Search can sometimes fail for complex queries
        pass
    
    # If no match is found
    return None

# --- Main Processing Function ---

def process_files_for_range(time_range_str: str):
    """Loads data for a range, aggregates imports/exports, normalizes, and returns."""
    dates = get_dates_for_range(time_range_str)
    import_counts = defaultdict(int)
    export_counts = defaultdict(int)
    total_imports = 0
    total_exports = 0

    # --- Load Providers ---
    providers_data = []
    try:
        with open(PROVIDERS_FILE_PATH, 'r', encoding='utf-8') as f:
            providers_data = json.load(f)
        print(f"Loaded {len(providers_data)} providers from {PROVIDERS_FILE_PATH}")
    except FileNotFoundError:
        print(f"ERROR: providers.json not found at {PROVIDERS_FILE_PATH}")
        return {"importData": {}, "exportData": {}}
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse providers.json: {e}")
        return {"importData": {}, "exportData": {}}
    except Exception as e:
        print(f"ERROR: Unexpected error loading providers.json: {e}")
        return {"importData": {}, "exportData": {}}

    provider_country_map = {}
    for p in providers_data:
        provider_id = p.get("id")
        provider_country = p.get("country")
        if provider_id and provider_country and isinstance(provider_country, str):
            provider_country_map[provider_id.lower()] = provider_country
        else:
            print(f"Warning: Skipping provider due to missing/invalid id or country: {p}")

    print(f"Processed provider map: {len(provider_country_map)} entries")

    # --- Process Daily Article Files ---
    print(f"Processing data for {time_range_str} ({len(dates)} dates)...")
    processed_article_count = 0
    skipped_articles_no_country = 0
    failed_country_lookups = 0

    for date_str in dates:
        articles_file_path = os.path.join(DATA_ROOT_DIR, date_str, "articles.json")
        if not os.path.exists(articles_file_path):
            # print(f"Info: Data file not found for {date_str}, skipping.")
            continue

        try:
            with open(articles_file_path, 'r', encoding='utf-8') as f:
                daily_data = json.load(f)

            articles = daily_data.get("data", [])
            # print(f"  Processing {len(articles)} articles for {date_str}")

            for article in articles:
                processed_article_count += 1
                source_provider_id = article.get("providerId", "").lower()
                source_country_code = provider_country_map.get(source_provider_id)

                if not source_country_code:
                    # print(f"Warning: Country code not found for provider '{article.get('providerId')}'. Skipping article.")
                    skipped_articles_no_country += 1
                    continue

                mentioned_country_codes = set()
                ner_list = article.get("ner", [])
                if isinstance(ner_list, list):
                    for entity in ner_list:
                        if isinstance(entity, dict) and entity.get("label") == "LOC":
                            entity_name = entity.get("entity", "")
                            country_code = get_country_code_for_location(entity_name)
                            
                            # Handle if country_code is a list (for regions)
                            if isinstance(country_code, list):
                                # Distribute the mention across all countries in the region
                                # Select a random subset of countries (between 3 and 5) to avoid overwhelming
                                if len(country_code) > 5:
                                    selected_countries = random.sample(country_code, random.randint(3, 5))
                                else:
                                    selected_countries = country_code
                                    
                                for code in selected_countries:
                                    mentioned_country_codes.add(code)
                            elif country_code:
                                mentioned_country_codes.add(country_code)
                            else:
                                failed_country_lookups += 1
                                # Don't print failures for regions and general areas
                                if len(entity_name.split()) > 1 or len(entity_name) < 3:
                                    continue
                                #print(f"Info: Could not map '{entity_name}' to a country code")
                # else: print(f"Warning: article.ner is not a list: {article.get('id')}")

                if not mentioned_country_codes:
                    continue # Skip articles that don't mention known countries

                # --- Calculate Exports --- 
                # Article from source_country_code mentions *other* known countries
                for mentioned_code in mentioned_country_codes:
                    if mentioned_code != source_country_code:
                        export_counts[source_country_code] += 1
                        total_exports += 1

                # --- Calculate Imports --- 
                # Article mentions a country (mentioned_code), and the source is *different*
                for mentioned_code in mentioned_country_codes:
                    if mentioned_code != source_country_code:
                        import_counts[mentioned_code] += 1
                        total_imports += 1



        except json.JSONDecodeError as e:
            print(f"ERROR: Failed to parse JSON in {articles_file_path}: {e}")
        except Exception as e:
            print(f"ERROR: Unexpected error processing {articles_file_path}: {e}")

    print(f"Finished processing. Total articles considered: {processed_article_count}")
    if skipped_articles_no_country > 0:
        print(f"Warning: Skipped {skipped_articles_no_country} articles due to unknown provider country.")
    if failed_country_lookups > 0:
        print(f"Info: Failed to map {failed_country_lookups} location entities to country codes.")
    print(f"Total imports counted: {total_imports}, Total exports counted: {total_exports}")


    # --- Normalize Data ---
    normalized_import_data = {country: (count / total_imports if total_imports > 0 else 0) for country, count in import_counts.items()}
    normalized_export_data = {country: (count / total_exports if total_exports > 0 else 0) for country, count in export_counts.items()}


    # Ensure all countries from COUNTRY_CODE_TO_NAME are present with 0 if missing
    all_codes = set(COUNTRY_CODE_TO_NAME.keys())
    final_import = {code: normalized_import_data.get(code, 0) for code in all_codes}
    final_export = {code: normalized_export_data.get(code, 0) for code in all_codes}

    return {"importData": final_import, "exportData": final_export}

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
    print("Starting map data aggregation...")
    main()
    print("\nMap data aggregation finished.") 