import os
import json
from datetime import datetime
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
    
    print("\nPipeline completed successfully!")

if __name__ == '__main__':
    main()
