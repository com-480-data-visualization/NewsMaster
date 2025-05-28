#!/usr/bin/env python3
"""
Standalone script to populate db.json with data from all existing articles.
This script does exactly what the update_db_json() function does in run.py.
"""

import os
import json
import glob
from datetime import datetime, timedelta

def get_today_date_str():
    """Return the current date as DD.MM.YYYY string."""
    return datetime.now().strftime("%d.%m.%Y")

def populate_db_json():
    """Aggregate stats from all articles.json files and update db.json with real data."""
    # Get the parent directory (NewsMaster root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    data_dir = os.path.join(project_root, 'public', 'data')
    db_path = os.path.join(data_dir, 'db.json')
    today_str = get_today_date_str()

    print(f"Looking for articles in: {data_dir}")
    print(f"Will create/update db.json at: {db_path}")

    # Find all articles.json files in data/date/ subfolders
    articles_files = glob.glob(os.path.join(data_dir, '*/articles.json'))
    print(f"Found {len(articles_files)} articles.json files")
    
    stats_per_day = {}
    total_articles = 0
    week_dates = []
    today_articles = 0
    today_ner = 0
    week_articles = 0
    
    # Get last 7 days including today
    for i in range(7):
        d = datetime.now() - timedelta(days=i)
        week_dates.append(d.strftime('%d.%m.%Y'))

    print(f"Week dates (last 7 days): {week_dates}")

    for file in articles_files:
        date_folder = os.path.basename(os.path.dirname(file))
        print(f"Processing {file} (date: {date_folder})")
        
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            articles = data.get('data', [])
            n_articles = len(articles)
            n_ner = sum(len(a.get('ner', [])) for a in articles)
            
            stats_per_day[date_folder] = {
                'date': date_folder, 
                'articles': n_articles, 
                'ner': n_ner
            }
            total_articles += n_articles
            
            if date_folder == today_str:
                today_articles = n_articles
                today_ner = n_ner
                print(f"  Today's data: {n_articles} articles, {n_ner} NER entities")
            
            if date_folder in week_dates:
                week_articles += n_articles
                print(f"  Week data: {n_articles} articles added to week total")
            
            print(f"  {date_folder}: {n_articles} articles, {n_ner} NER entities")
            
        except Exception as e:
            print(f"Error reading {file}: {e}")

    # Sort by date ascending
    articles_per_day = [stats_per_day[d] for d in sorted(stats_per_day.keys())]
    
    # Create the db.json structure
    db = {
        'articles_per_day': articles_per_day,
        'total_ner_today': today_ner,
        'total_articles_today': today_articles,
        'total_articles_week': week_articles,
        'total_articles_total': total_articles
    }
    
    # Ensure the data directory exists
    os.makedirs(data_dir, exist_ok=True)
    
    # Write db.json
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=4)
    
    print(f"\ndb.json updated successfully!")
    print(f"Summary:")
    print(f"  - Total articles across all days: {total_articles}")
    print(f"  - Articles today ({today_str}): {today_articles}")
    print(f"  - Articles this week: {week_articles}")
    print(f"  - NER entities today: {today_ner}")
    print(f"  - Days with data: {len(articles_per_day)}")
    
    return db

def main():
    print("Starting db.json population script...")
    print("This script will aggregate data from all existing articles.json files")
    print("and populate/update the db.json file.\n")
    
    try:
        db_data = populate_db_json()
        print("\nScript completed successfully!")
        
        # Show a preview of the created db.json
        print("\nPreview of db.json structure:")
        print(f"  - articles_per_day: {len(db_data['articles_per_day'])} entries")
        print(f"  - total_articles_total: {db_data['total_articles_total']}")
        print(f"  - total_articles_week: {db_data['total_articles_week']}")
        print(f"  - total_articles_today: {db_data['total_articles_today']}")
        print(f"  - total_ner_today: {db_data['total_ner_today']}")
        
        # Also display the actual file path where db.json was written
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        db_path = os.path.join(project_root, 'public', 'data', 'db.json')
        print(f"\ndb.json written to: {db_path}")
        
    except Exception as e:
        print(f"CRITICAL: An error occurred: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    import sys
    exit_code = main()
    sys.exit(exit_code)
