from transformers import AutoTokenizer, AutoModelForTokenClassification
import torch
from typing import List, Dict, Union

class BERTNER:
    def __init__(self):
        """Initialize the BERT-NER model and tokenizer."""
        try:
            self.tokenizer = AutoTokenizer.from_pretrained("dslim/bert-large-NER")
            self.model = AutoModelForTokenClassification.from_pretrained("dslim/bert-large-NER")
            self.model.eval()  # Set model to evaluation mode
        except Exception as e:
            print(f"CRITICAL: Failed to load BERT NER model or tokenizer: {e}")
            # Depending on desired behavior, could raise it to stop everything
            # or set a flag to indicate model is not usable.
            self.tokenizer = None
            self.model = None
            raise # Re-raise to make sure the application knows the model isn't available
        
        # Define the label mapping
        self.label_map = {
            0: "O",
            1: "B-MISC",
            2: "I-MISC",
            3: "B-PER",
            4: "I-PER",
            5: "B-ORG",
            6: "I-ORG",
            7: "B-LOC",
            8: "I-LOC"
        }

    def predict(self, text: str) -> List[Dict[str, Union[str, int, int]]]:
        """
        Perform named entity recognition on the input text.
        
        Args:
            text (str): Input text to analyze
            
        Returns:
            List[Dict]: List of dictionaries containing entity information
            Each dictionary contains:
            - entity: The entity text
            - label: The entity type (PER, ORG, LOC, MISC)
            - start: Start position in the original text
            - end: End position in the original text
        """
        # Tokenize the input text, requesting offset mapping
        inputs_dict = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True, return_offsets_mapping=True)
        offset_mapping = inputs_dict.pop("offset_mapping")[0].tolist()  # Pop, as model doesn't accept it
        input_ids = inputs_dict["input_ids"][0]
        
        # Get predictions
        with torch.no_grad():
            outputs = self.model(**inputs_dict)
            predictions = torch.argmax(outputs.logits, dim=2)[0] # predictions is already the first batch item
        
        # Convert predictions to labels and get token strings
        tokens_str_list = self.tokenizer.convert_ids_to_tokens(input_ids.tolist())
        labels_str_list = [self.label_map[pred.item()] for pred in predictions]

        entities = []
        active_entity_char_start = -1
        active_entity_char_end = -1  # End of the last token of the current entity
        active_entity_label_short = None  # e.g., "PER", "LOC"

        for i in range(len(tokens_str_list)):
            token_text = tokens_str_list[i]
            label = labels_str_list[i]
            char_start, char_end = offset_mapping[i]

            # Handle special tokens ([CLS], [SEP], [PAD]) or tokens not mapping to original text
            if token_text in ["[CLS]", "[SEP]", "[PAD]"] or char_start == char_end:
                # If an entity was active, it ends here.
                if active_entity_label_short and active_entity_char_start != -1:
                    entity_text_final = text[active_entity_char_start:active_entity_char_end].strip()
                    if entity_text_final and len(entity_text_final) > 1: # Avoid empty and single-char entities
                        entities.append({
                            "entity": entity_text_final,
                            "label": active_entity_label_short,
                            "start": active_entity_char_start,
                            "end": active_entity_char_end
                        })
                active_entity_label_short = None # Reset
                active_entity_char_start = -1
                active_entity_char_end = -1
                continue

            if label.startswith("B-"):
                # If a previous entity was active, commit it
                if active_entity_label_short and active_entity_char_start != -1:
                    entity_text_final = text[active_entity_char_start:active_entity_char_end].strip()
                    if entity_text_final and len(entity_text_final) > 1:
                        entities.append({
                            "entity": entity_text_final,
                            "label": active_entity_label_short,
                            "start": active_entity_char_start,
                            "end": active_entity_char_end
                        })
                
                # Start new entity
                active_entity_label_short = label[2:]
                active_entity_char_start = char_start
                active_entity_char_end = char_end
            
            elif label.startswith("I-"):
                current_label_short = label[2:]
                # Only extend if an entity is active AND the type matches
                if active_entity_label_short and active_entity_label_short == current_label_short and active_entity_char_start != -1:
                    active_entity_char_end = char_end # Extend the end boundary
                else:
                    # Invalid I-tag (no active B-tag, or type mismatch)
                    # End any previous entity
                    if active_entity_label_short and active_entity_char_start != -1:
                        entity_text_final = text[active_entity_char_start:active_entity_char_end].strip()
                        if entity_text_final and len(entity_text_final) > 1:
                             entities.append({
                                "entity": entity_text_final,
                                "label": active_entity_label_short,
                                "start": active_entity_char_start,
                                "end": active_entity_char_end
                            })
                    active_entity_label_short = None # Reset: this I-tag does not continue or start a valid entity
                    active_entity_char_start = -1
                    active_entity_char_end = -1


            elif label == "O":
                # If an entity was active, commit it
                if active_entity_label_short and active_entity_char_start != -1:
                    entity_text_final = text[active_entity_char_start:active_entity_char_end].strip()
                    if entity_text_final and len(entity_text_final) > 1:
                        entities.append({
                            "entity": entity_text_final,
                            "label": active_entity_label_short,
                            "start": active_entity_char_start,
                            "end": active_entity_char_end
                        })
                active_entity_label_short = None # Reset
                active_entity_char_start = -1
                active_entity_char_end = -1
        
        # Add the last entity if it's still active at the end of all tokens
        if active_entity_label_short and active_entity_char_start != -1:
            entity_text_final = text[active_entity_char_start:active_entity_char_end].strip()
            if entity_text_final and len(entity_text_final) > 1:
                entities.append({
                    "entity": entity_text_final,
                    "label": active_entity_label_short,
                    "start": active_entity_char_start,
                    "end": active_entity_char_end
                })
        
        return entities

    def __call__(self, text: str) -> List[Dict[str, Union[str, int, int]]]:
        """
        Alias for predict method to allow direct calling of the class instance.
        
        Args:
            text (str): Input text to analyze
            
        Returns:
            List[Dict]: List of dictionaries containing entity information
        """
        if not self.model or not self.tokenizer: # Check if model loaded successfully
            print("Error: BERT NER model is not available. Returning empty list of entities.")
            return []
        try:
            return self.predict(text)
        except Exception as e:
            print(f"Error during NER prediction for text: '{text[:100]}...': {e}")
            return [] # Return empty list if an error occurs
