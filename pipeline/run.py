import os
import json
from datetime import datetime, timedelta
from ingestor_clean import fetch_all_articles
from translate_to_en import Translator
from ner import BERTNER
from entity_normalizer import EntityNormalizer

def get_today_date_str():
    """Return the current date as DD.MM.YYYY string."""
    return datetime.now().strftime("%d.%m.%Y")

def process_articles(articles):
    """Process articles through translation and NER."""
    translator = Translator()
    ner = BERTNER()
    normalizer = EntityNormalizer()
    
    # Process articles in batches
    batch_size = 10
    processed_articles = []
    
    for i in range(0, len(articles), batch_size):
        batch = articles[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(articles) + batch_size - 1)//batch_size}")
        
        # Translate titles and descriptions
        titles = [article['title'] for article in batch]
        descriptions = [article['description'] for article in batch]
        
        translated_titles = translator.translate_batch(titles)
        translated_descriptions = translator.translate_batch(descriptions)
        
        # Process each article in the batch
        for article, trans_title, trans_desc in zip(batch, translated_titles, translated_descriptions):
            # Run NER on translated title and description
            title_entities = ner(trans_title)
            desc_entities = ner(trans_desc)
            
            # Combine entities and add source information
            combined_entities = []
            
            # Add title entities with source
            for entity in title_entities:
                entity['source'] = 'title'
                combined_entities.append(entity)
            
            # Add description entities with source
            for entity in desc_entities:
                entity['source'] = 'description'
                combined_entities.append(entity)
            
            # Normalize all entities
            normalized_entities = normalizer(combined_entities)
            
            # Add processed data to article
            processed_article = article.copy()
            processed_article.update({
                'translatedTitle': trans_title,
                'translatedDescription': trans_desc,
                'ner': normalized_entities
            })
            processed_articles.append(processed_article)
    
    return processed_articles

def save_processed_articles(processed_articles):
    """Save processed articles to a JSON file in a date-specific directory."""
    date_str = get_today_date_str()
    output_dir = os.path.join('data', date_str)
    output_filename = os.path.join(output_dir, 'articles.json')
    
    output_data = {
        "data": processed_articles,
        "processedAt": datetime.now().isoformat()
    }
    
    try:
        # Ensure the date-specific directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"Processed articles saved to: {output_filename}")
    except Exception as e:
        print(f"Error saving processed articles: {e}")

def update_db_json():
    """Aggregate stats from all articles.json files and update db.json with real data."""
    import glob
    from collections import defaultdict

    data_dir = os.path.join('data')
    db_path = os.path.join(data_dir, 'db.json')
    today_str = get_today_date_str()

    # Find all articles.json files in data/date/ subfolders
    articles_files = glob.glob(os.path.join(data_dir, '*/articles.json'))
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

    for file in articles_files:
        date_folder = os.path.basename(os.path.dirname(file))
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            articles = data.get('data', [])
            n_articles = len(articles)
            n_ner = sum(len(a.get('ner', [])) for a in articles)
            stats_per_day[date_folder] = {'date': date_folder, 'articles': n_articles, 'ner': n_ner}
            total_articles += n_articles
            if date_folder == today_str:
                today_articles = n_articles
                today_ner = n_ner
            if date_folder in week_dates:
                week_articles += n_articles
        except Exception as e:
            print(f"Error reading {file}: {e}")

    # Sort by date ascending
    articles_per_day = [stats_per_day[d] for d in sorted(stats_per_day.keys())]
    db = {
        'articles_per_day': articles_per_day,
        'total_ner_today': today_ner,
        'total_articles_today': today_articles,
        'total_articles_week': week_articles,
        'total_articles_total': total_articles
    }
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=4)
    print(f"db.json updated with real data.")

def main():
    print("Starting news processing pipeline...")
    
    # Step 1: Fetch news directly
    print("\n1. Fetching news...")
    articles = fetch_all_articles()
    
    # Step 2: Check if articles were fetched and process
    if not articles:
        print("No articles fetched or an error occurred during fetching.")
        return
    print(f"Fetched {len(articles)} articles.")
    
    # Step 3: Process articles (translate and NER)
    print("\n2. Processing articles...")
    processed_articles = process_articles(articles)
    
    # Step 4: Save processed articles
    print("\n3. Saving processed articles...")
    save_processed_articles(processed_articles)
    
    # Update db.json with real data
    print("\n4. Updating db.json...")
    update_db_json()
    
    print("\nPipeline completed successfully!")

if __name__ == '__main__':
    main()
