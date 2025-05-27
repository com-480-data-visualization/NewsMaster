import os
import json
import re
from datetime import datetime
from ingestor_clean import fetch_all_articles
from translate_to_en import Translator
from ner import BERTNER
from entity_normalizer import EntityNormalizer
from temporal_trends import update_current_week_trends
from aggregate_map_data import main as aggregate_map_data

def get_today_date_str():
    """Return the current date as DD.MM.YYYY string."""
    return datetime.now().strftime("%d.%m.%Y")

def global_entity_normalization(processed_articles):
    """
    Perform global entity normalization across all articles.
    Replace shorter entity names with longer ones when one is a substring of another.
    """
    # Collect all unique entities by label
    entities_by_label = {}
    
    for article in processed_articles:
        for entity in article.get('ner', []):
            label = entity['label']
            entity_text = entity['entity']
            
            if label not in entities_by_label:
                entities_by_label[label] = set()
            entities_by_label[label].add(entity_text)
    
    # For each label, find replacement mappings (short -> long)
    replacement_mappings = {}
    
    for label, entities in entities_by_label.items():
        entities_list = list(entities)
        
        for i, short_entity in enumerate(entities_list):
            for j, long_entity in enumerate(entities_list):
                if i != j and short_entity.lower() in long_entity.lower() and len(short_entity) < len(long_entity):
                    # Check if short_entity is a meaningful substring (word boundary)
                    pattern = r'\b' + re.escape(short_entity.lower()) + r'\b'
                    if re.search(pattern, long_entity.lower()):
                        replacement_mappings[(short_entity, label)] = long_entity
    
    # Apply replacements to all articles
    for article in processed_articles:
        for entity in article.get('ner', []):
            key = (entity['entity'], entity['label'])
            if key in replacement_mappings:
                entity['entity'] = replacement_mappings[key]
    
    return processed_articles

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
            try:
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
            except Exception as e:
                print(f"Error processing article: {article.get('title', 'N/A')}")
                print(f"Translated Title: {trans_title}")
                print(f"Translated Description: {trans_desc}")
                print(f"Error details: {e}")
                # Optionally, re-raise the exception if you want the script to stop
                # raise 
    
    # Perform global entity normalization
    print("Performing global entity normalization...")
    processed_articles = global_entity_normalization(processed_articles)
    
    return processed_articles

def save_processed_articles(processed_articles):
    """Save processed articles to a JSON file in a date-specific directory."""
    date_str = get_today_date_str()
    output_dir = os.path.join('public', 'data', date_str)
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

def main():
    print("Starting news processing pipeline...")

    # WARNING : Make sure to update the requirements.txt when adding new steps to the pipeline.
    
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
    
    # Step 5: Update temporal trends
    print("\n4. Updating temporal trends...")
    update_current_week_trends()

    # Step 6: Aggregate map data
    print("\n5. Aggregating map data...")
    aggregate_map_data()

    print("\nPipeline completed successfully!")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"CRITICAL: An unhandled exception occurred in the main pipeline: {e}")
        # Optionally, re-raise or exit with a specific code
        # raise
        # import sys
        # sys.exit(1) 
