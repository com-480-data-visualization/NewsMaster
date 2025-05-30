import os
import json
import re
from datetime import datetime, timedelta
from ingestor_clean import fetch_all_articles
from translate_to_en import Translator
from ner import BERTNER
from entity_normalizer import EntityNormalizer
from temporal_trends import process_specific_day
from aggregate_map_data import main as aggregate_map_data

def get_today_date_str():
    """Return the current date as DD.MM.YYYY string."""
    return datetime.now().strftime("%d.%m.%Y")

def global_entity_normalization(processed_articles):
    """
    Perform global entity normalization across all articles using frequency-based mapping.
    Groups similar entities together and maps all variations to the most frequently used form.
    """
    from collections import defaultdict, Counter
    
    # Collect all entities with their frequencies by label
    entity_counts_by_label = defaultdict(Counter)
    
    # First pass: count all entity occurrences
    for article in processed_articles:
        for entity in article.get('ner', []):
            label = entity['label']
            entity_text = entity['entity'].strip()
            if entity_text:  # Only count non-empty entities
                entity_counts_by_label[label][entity_text] += 1
    
    # For each label, find groups of similar entities and determine canonical forms
    replacement_mappings = {}
    
    for label, entity_counter in entity_counts_by_label.items():
        print(f"\nProcessing {label} entities:")
        entities_list = list(entity_counter.keys())
        processed_entities = set()
        
        for i, entity1 in enumerate(entities_list):
            if entity1 in processed_entities:
                continue
                
            # Find all entities similar to entity1
            similar_group = [entity1]
            
            for j, entity2 in enumerate(entities_list):
                if i != j and entity2 not in processed_entities:
                    # Check if entities are similar (one contains the other as word boundary)
                    if are_entities_similar(entity1, entity2):
                        similar_group.append(entity2)
            
            # If we found a group of similar entities, determine the canonical form
            if len(similar_group) > 1:
                # Choose the most frequent entity as canonical
                group_with_counts = [(entity, entity_counter[entity]) for entity in similar_group]
                group_with_counts.sort(key=lambda x: x[1], reverse=True)  # Sort by frequency
                
                canonical_entity = group_with_counts[0][0]
                canonical_count = group_with_counts[0][1]
                
                print(f"  Found similar group: {[f'{e} ({entity_counter[e]})' for e in similar_group]}")
                print(f"  → Canonical form: '{canonical_entity}' (used {canonical_count} times)")
                
                # Map all other variants to the canonical form
                for entity, count in group_with_counts[1:]:
                    replacement_mappings[(entity, label)] = canonical_entity
                    print(f"    Mapping '{entity}' ({count} times) → '{canonical_entity}'")
                
                # Mark all entities in this group as processed
                processed_entities.update(similar_group)
            else:
                # Single entity, mark as processed
                processed_entities.add(entity1)
    
    # Apply replacements to all articles
    replacement_count = 0
    for article in processed_articles:
        for entity in article.get('ner', []):
            key = (entity['entity'], entity['label'])
            if key in replacement_mappings:
                old_entity = entity['entity']
                entity['entity'] = replacement_mappings[key]
                replacement_count += 1
    
    if replacement_count > 0:
        print(f"\nApplied {replacement_count} entity replacements across all articles.")
    else:
        print("\nNo entity replacements needed.")
    
    return processed_articles

def are_entities_similar(entity1, entity2):
    """
    Determine if two entities are similar enough to be considered variants of the same entity.
    """
    e1_lower = entity1.lower().strip()
    e2_lower = entity2.lower().strip()
    
    if e1_lower == e2_lower:
        return True
    
    # Check if one is a substring of the other (with word boundaries)
    if len(e1_lower) < len(e2_lower):
        shorter, longer = e1_lower, e2_lower
        shorter_entity, longer_entity = entity1, entity2
    else:
        shorter, longer = e2_lower, e1_lower
        shorter_entity, longer_entity = entity2, entity1
    
    # Use word boundary regex to check if shorter is contained in longer
    pattern = r'\b' + re.escape(shorter) + r'\b'
    if re.search(pattern, longer):
        # Additional validation based on entity characteristics
        shorter_parts = shorter.split()
        longer_parts = longer.split()
        
        # For very similar lengths (difference of 1-2 words), likely the same entity
        if len(longer_parts) <= len(shorter_parts) + 2:
            return True
        
        # For larger differences, check if there's significant overlap
        # by ensuring most parts of shorter name are in longer
        overlap = set(shorter_parts) & set(longer_parts)
        if len(overlap) >= len(shorter_parts):  # All parts of shorter name are in longer
            return True
    
    # Special case: check for person names with middle initials
    # e.g., "Donald Trump" vs "Donald J. Trump"
    if are_similar_person_names(entity1, entity2):
        return True
    
    # Special case: check for common abbreviations
    # This handles cases like "EU" -> "European Union", "USA" -> "United States", etc.
    if len(shorter) <= 5 and len(longer) > 5:  # Shorter is likely an abbreviation
        # Check if the shorter entity could be an abbreviation of the longer one
        if is_likely_abbreviation(shorter_entity, longer_entity):
            return True
    
    return False

def are_similar_person_names(name1, name2):
    """
    Check if two person names are similar, accounting for middle initials and minor variations.
    """
    # Split names into parts and normalize
    parts1 = [part.rstrip('.').lower() for part in name1.split()]
    parts2 = [part.rstrip('.').lower() for part in name2.split()]
    
    # Filter out single letter parts (likely middle initials)
    significant_parts1 = [part for part in parts1 if len(part) > 1]
    significant_parts2 = [part for part in parts2 if len(part) > 1]
    
    # If significant parts are the same, they're similar names
    if significant_parts1 == significant_parts2:
        return True
    
    # Check if one is a subset of the other (allowing for additional middle names/initials)
    if (set(significant_parts1).issubset(set(parts2)) or 
        set(significant_parts2).issubset(set(parts1))):
        # Additional check: ensure the names are in similar order
        if len(significant_parts1) >= 2 and len(significant_parts2) >= 2:
            # Check if first and last names match
            if (significant_parts1[0] == significant_parts2[0] and 
                significant_parts1[-1] == significant_parts2[-1]):
                return True
    
    return False

def is_likely_abbreviation(short_entity, long_entity):
    """
    Check if short_entity could be an abbreviation of long_entity.
    """
    short_clean = short_entity.upper().replace('.', '').replace(' ', '')
    long_words = long_entity.split()
    
    # Try to match abbreviation to first letters of words
    if len(short_clean) == len(long_words):
        # Check if each character in short matches first letter of corresponding word
        for i, char in enumerate(short_clean):
            if char != long_words[i][0].upper():
                return False
        return True
    
    # Handle cases where abbreviation might skip common words like "of", "the", "and"
    skip_words = {'of', 'the', 'and', 'in', 'for', 'to', 'with'}
    significant_words = [word for word in long_words if word.lower() not in skip_words]
    
    if len(short_clean) == len(significant_words):
        for i, char in enumerate(short_clean):
            if char != significant_words[i][0].upper():
                return False
        return True
    
    return False

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

def update_db_json():
    """Aggregate stats from all articles.json files and update db.json with real data."""
    import glob
    from collections import defaultdict

    data_dir = os.path.join('public', 'data')
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

def reprocess_existing_data(date_str=None, all_dates=False):
    """
    Reprocess existing articles data with improved entity normalization.
    Skips ingestion and NER, but applies new normalization and updates derived data.
    
    Args:
        date_str (str): Specific date to reprocess in DD.MM.YYYY format. If None, processes today.
        all_dates (bool): If True, reprocess all available dates. Overrides date_str.
    """
    import glob
    
    data_dir = os.path.join('public', 'data')
    
    if all_dates:
        # Find all date directories with articles.json
        articles_files = glob.glob(os.path.join(data_dir, '*/articles.json'))
        dates_to_process = [os.path.basename(os.path.dirname(f)) for f in articles_files]
        print(f"Found {len(dates_to_process)} dates to reprocess: {sorted(dates_to_process)}")
    else:
        # Process specific date or today
        if date_str is None:
            date_str = get_today_date_str()
        dates_to_process = [date_str]
        print(f"Reprocessing date: {date_str}")
    
    for current_date in sorted(dates_to_process):
        print(f"\n{'='*60}")
        print(f"REPROCESSING {current_date}")
        print(f"{'='*60}")
        
        # Load existing articles
        articles_file = os.path.join(data_dir, current_date, 'articles.json')
        if not os.path.exists(articles_file):
            print(f"❌ No articles.json found for {current_date}, skipping...")
            continue
        
        try:
            print(f"📁 Loading existing articles from {articles_file}")
            with open(articles_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            processed_articles = data.get('data', [])
            if not processed_articles:
                print(f"❌ No articles found in {current_date}, skipping...")
                continue
                
            print(f"✅ Loaded {len(processed_articles)} articles")
            
            # Count entities before normalization
            entity_count_before = 0
            for article in processed_articles:
                entity_count_before += len(article.get('ner', []))
            print(f"📊 Total entities before normalization: {entity_count_before}")
            
            # Apply improved global entity normalization
            print(f"\n🔄 Applying improved entity normalization...")
            processed_articles = global_entity_normalization(processed_articles)
            
            # Count entities after normalization
            entity_count_after = 0
            unique_entities = set()
            for article in processed_articles:
                for entity in article.get('ner', []):
                    entity_count_after += 1
                    unique_entities.add((entity['entity'], entity['label']))
            print(f"📊 Total entities after normalization: {entity_count_after}")
            print(f"📊 Unique entities: {len(unique_entities)}")
            
            # Save updated articles
            print(f"\n💾 Saving updated articles...")
            output_data = {
                "data": processed_articles,
                "processedAt": data.get('processedAt', datetime.now().isoformat()),
                "reprocessedAt": datetime.now().isoformat()
            }
            
            with open(articles_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            print(f"✅ Updated articles saved to {articles_file}")
            
        except Exception as e:
            print(f"❌ Error processing {current_date}: {e}")
            continue
    
    # After processing all dates, update derived data
    print(f"\n{'='*60}")
    print("UPDATING DERIVED DATA")
    print(f"{'='*60}")
    
    # Update db.json with real data
    print("\n📊 Updating db.json...")
    update_db_json()
    
    if not all_dates:
        # For single date processing, update topics and map data
        target_date = dates_to_process[0]
        print(f"\n📈 Updating daily topics for {target_date}...")
        
        try:
            from temporal_trends import process_specific_day
            top_ner_entity = process_specific_day(target_date)
            if top_ner_entity:
                print(f"✅ Successfully updated topics.json for {target_date}")
                print(f"🔝 Top NER entity: {top_ner_entity}")
                
                # Update map data
                print(f"\n🗺️ Updating map data for {target_date}...")
                from aggregate_map_data import main as aggregate_map_data
                aggregate_map_data(top_ner_entity)
            else:
                print(f"❌ Failed to update topics.json for {target_date}")
        except Exception as e:
            print(f"❌ Error updating topics/map data: {e}")
    else:
        # For all dates processing, update all topics and map data
        print(f"\n📈 Updating all daily topics...")
        try:
            from temporal_trends import process_specific_day
            
            # Process topics for each date
            all_top_entities = []
            for current_date in sorted(dates_to_process):
                try:
                    top_ner_entity = process_specific_day(current_date)
                    if top_ner_entity:
                        all_top_entities.append(top_ner_entity)
                        print(f"✅ Updated topics for {current_date}: {top_ner_entity}")
                    else:
                        print(f"⚠️ No topics data for {current_date}")
                except Exception as e:
                    print(f"❌ Error updating topics for {current_date}: {e}")
            
            # Update map data for the most recent date's top entity
            if all_top_entities:
                latest_top_entity = all_top_entities[-1]  # Use the most recent
                print(f"\n🗺️ Updating map data with latest top entity: {latest_top_entity}")
                from aggregate_map_data import main as aggregate_map_data
                aggregate_map_data(latest_top_entity, last_30_days=True)
        except Exception as e:
            print(f"❌ Error in bulk topics/map update: {e}")
    
    print(f"\n🎉 Reprocessing completed successfully!")

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
    
    # Update db.json with real data
    print("\n4. Updating db.json...")
    update_db_json()
    
    # Step 5: Update daily topics (NER percentages)
    print("\n5. Updating daily topics...")
    today_date = get_today_date_str()
    top_ner_entity = process_specific_day(today_date)
    if top_ner_entity:
        print(f"Successfully created topics.json for {today_date}")
        print(f"Top NER entity for today ({today_date}): {top_ner_entity}")
    else:
        print(f"Failed to create topics.json for {today_date} or no NER data found")

    # Step 6: Aggregate map data
    print("\n6. Aggregating map data...")
    aggregate_map_data(top_ner_entity)

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
