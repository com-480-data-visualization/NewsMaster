import os
import json
from datetime import datetime, timedelta
import re
from collections import Counter

def get_current_week_range():
    """Get the current week range in format DD-DD.MM.YYYY"""
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    
    # Format as DD-DD.MM.YYYY
    week_range = f"{monday.day:02d}-{sunday.day:02d}.{sunday.month:02d}.{sunday.year}"
    return week_range

def get_date_folders_for_current_week():
    """Get all date folders that belong to the current week"""
    data_dir = "../public/data"
    current_week_range = get_current_week_range()
    parts = current_week_range.split('.')
    
    if len(parts) != 3:  # Should be [DD-DD, MM, YYYY]
        return []
    
    day_range = parts[0]  # DD-DD
    month = parts[1]      # MM
    year = parts[2]       # YYYY
    
    # Split the day range
    day_parts = day_range.split('-')
    if len(day_parts) != 2:
        return []
    
    start_day = day_parts[0]
    end_day = day_parts[1]
    
    try:
        start_day = int(start_day)
        end_day = int(end_day)
        month = int(month)
        year = int(year)
    except ValueError as e:
        return []
    
    # Create date objects for the week range
    start_date = datetime(year, month if start_day < end_day else (month - 1) % 12, start_day)
    end_date = datetime(year, month, end_day)

    date_folders = []
    
    # Check if the directory exists
    if not os.path.exists(data_dir):
        return []
    
    # Check all items in the data directory
    for item in os.listdir(data_dir):
        item_path = os.path.join(data_dir, item)
        # Check if it's a directory and matches date format DD.MM.YYYY
        if os.path.isdir(item_path) and re.match(r'\d{2}\.\d{2}\.\d{4}', item):
            try:
                day, month, year = map(int, item.split('.'))
                folder_date = datetime(year, month, day)
                
                if start_date <= folder_date <= end_date:
                    date_folders.append(item)
            except ValueError:
                continue
    
    return date_folders

def extract_entities_from_articles(date_dir):
    """Extract named entities from articles for a specific date"""
    articles_file = os.path.join("../public/data", date_dir, "articles.json")
    if not os.path.exists(articles_file):
        return []
    
    with open(articles_file, 'r', encoding='utf-8') as f:
        try:
            articles_data = json.load(f)
            entities = []
            
            for article in articles_data.get('data', []):
                for ner_item in article.get('ner', []):
                    if 'entity' in ner_item:
                        entities.append(ner_item['entity'].lower())
            
            return entities, len(articles_data.get('data', []))
        except json.JSONDecodeError:
            return [], 0

def update_current_week_trends():
    """Update topics.json with only the current week's data"""
    # Get the current week range
    current_week = get_current_week_range()
    
    # Get date folders for the current week
    date_folders = get_date_folders_for_current_week()
    
    if not date_folders:
        return

    # Collect all entities from the current week
    all_entities = []
    for date_folder in date_folders:
        entities, articles_number = extract_entities_from_articles(date_folder)
        all_entities.extend(entities)
    
    if not all_entities:
        return
    
    # Count entity occurrences
    entity_counter = Counter(all_entities)
    
    # Calculate percentages for all entities
    topics_data = {}
    for entity, count in entity_counter.items():
        percentage = round((count / articles_number * 100), 1)
        topics_data[entity] = {current_week: percentage}

    # Load existing topics.json - this file is in public/data/temporal_trends
    topics_file = os.path.join("../public/data", "temporal_trends", "topics.json")
    existing_data = {}
    
    if os.path.exists(topics_file):
        try:
            with open(topics_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except json.JSONDecodeError:
            pass
    
    # Update existing data with new week data
    for topic, weeks in topics_data.items():
        if topic in existing_data:
            # Update only the current week for existing topics
            existing_data[topic][current_week] = weeks[current_week]
        else:
            # Add new topic with current week data
            existing_data[topic] = {current_week: weeks[current_week]}
    
    # Save updated data
    os.makedirs(os.path.dirname(topics_file), exist_ok=True)
    try:
        with open(topics_file, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=4)
            print(f"Temporal trends updated successfully in {topics_file}")
            
    except IOError as e:
        print(f"Error saving temporal trends to {topics_file}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred while saving temporal trends: {e}")

if __name__ == "__main__":
    update_current_week_trends()
