import os
import json
import re
from collections import Counter

def get_all_date_folders():
    """Get all date folders in the data directory"""
    data_dir = "../public/data"
    date_folders = []
    
    # Check if the directory exists
    if not os.path.exists(data_dir):
        return []
    
    # Check all items in the data directory
    for item in os.listdir(data_dir):
        item_path = os.path.join(data_dir, item)
        # Check if it's a directory and matches date format DD.MM.YYYY
        if os.path.isdir(item_path) and re.match(r'\d{2}\.\d{2}\.\d{4}', item):
            date_folders.append(item)
    
    return sorted(date_folders)

def extract_entities_from_articles(date_folder):
    """Extract named entities from articles for a specific date"""
    articles_file = os.path.join("../public/data", date_folder, "articles.json")
    
    if not os.path.exists(articles_file):
        print(f"Articles file not found for {date_folder}")
        return [], 0
    
    try:
        with open(articles_file, 'r', encoding='utf-8') as f:
            articles_data = json.load(f)
            entities = []
            articles_count = len(articles_data.get('data', []))
            
            for article in articles_data.get('data', []):
                for ner_item in article.get('ner', []):
                    if 'entity' in ner_item:
                        # Normalize entity names to lowercase for consistency
                        entities.append(ner_item['entity'].lower().strip())
            
            return entities, articles_count
            
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for {date_folder}: {e}")
        return [], 0
    except Exception as e:
        print(f"Error processing articles for {date_folder}: {e}")
        return [], 0

def calculate_daily_ner_percentages(date_folder):
    """Calculate NER percentages for a specific day"""
    entities, total_articles = extract_entities_from_articles(date_folder)
    
    if not entities or total_articles == 0:
        print(f"No entities or articles found for {date_folder}")
        return {}
    
    # Count entity occurrences
    entity_counter = Counter(entities)
    
    # Calculate percentages
    ner_percentages = {}
    for entity, count in entity_counter.items():
        # Calculate percentage based on total articles
        percentage = round((count / total_articles) * 100, 2)
        ner_percentages[entity] = percentage
    
    return ner_percentages

def save_daily_topics(date_folder, ner_percentages):
    """Save the NER percentages to topics.json in the daily folder"""
    topics_file = os.path.join("../public/data", date_folder, "topics.json")
    
    try:
        with open(topics_file, 'w', encoding='utf-8') as f:
            json.dump(ner_percentages, f, indent=2, ensure_ascii=False)
        print(f"Topics saved successfully for {date_folder}")
        return True
        
    except Exception as e:
        print(f"Error saving topics for {date_folder}: {e}")
        return False

def process_single_day(date_folder):
    """Process a single day's data and create topics.json"""
    print(f"Processing {date_folder}...")
    
    # Calculate NER percentages for the day
    ner_percentages = calculate_daily_ner_percentages(date_folder)
    
    if not ner_percentages:
        print(f"No NER data to process for {date_folder}")
        return False
    
    # Save to topics.json
    success = save_daily_topics(date_folder, ner_percentages)
    
    if success:
        print(f"Successfully processed {date_folder} with {len(ner_percentages)} entities")
    
    return success

def process_all_days():
    """Process all available days and create topics.json for each"""
    date_folders = get_all_date_folders()
    
    if not date_folders:
        print("No date folders found in the data directory")
        return
    
    print(f"Found {len(date_folders)} date folders to process")
    
    successful_count = 0
    failed_count = 0
    
    for date_folder in date_folders:
        try:
            if process_single_day(date_folder):
                successful_count += 1
            else:
                failed_count += 1
        except Exception as e:
            print(f"Unexpected error processing {date_folder}: {e}")
            failed_count += 1
    
    print(f"\nProcessing complete:")
    print(f"Successfully processed: {successful_count} days")
    print(f"Failed to process: {failed_count} days")

def process_specific_day(date_folder):
    """Process a specific day's data"""
    if not re.match(r'\d{2}\.\d{2}\.\d{4}', date_folder):
        print(f"Invalid date format: {date_folder}. Expected format: DD.MM.YYYY")
        return False
    
    data_path = os.path.join("../public/data", date_folder)
    if not os.path.exists(data_path):
        print(f"Date folder not found: {date_folder}")
        return False
    
    return process_single_day(date_folder)

if __name__ == "__main__":
    # Process all available days
    process_all_days()
