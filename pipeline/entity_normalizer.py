import country_converter as coco
import usaddress
from typing import Dict, List, Union
import re

class EntityNormalizer:
    def __init__(self):
        """Initialize the entity normalizer with various normalization tools."""
        self.cc = coco.CountryConverter()

    def normalize_country(self, entity: str) -> str:
        """
        Normalize country names to their official names using country-converter.
        """
        try:
            normalized = self.cc.convert(entity, to='name_short', not_found=None)
            if normalized:
                return normalized
        except Exception as e:
            print(f"Error normalizing country '{entity}': {e}")
            pass
        return entity

    def normalize_organization(self, entity: str) -> str:
        """
        Normalize organization names to their official names.
        Currently a pass-through; can be extended with a library if needed.
        """
        return entity

    def normalize_person(self, entity: str) -> str:
        """
        Normalize person names to a standard format.
        """
        name = ' '.join(entity.split())
        return name.title()

    def normalize_location(self, entity_text: str) -> str:
        """
        Normalize location names to a standard format.
        Ensures a string is returned.
        """
        try:
            components, addr_type = usaddress.tag(entity_text)

            if addr_type == "RepeatedLabelError":
                if components and isinstance(components, list) and components:  # components is a list of OrderedDicts
                    # Take the first interpretation
                    first_interpretation = components[0]
                    if isinstance(first_interpretation, dict):
                         # Join its values, ensuring they are strings
                        return " ".join(str(v) for v in first_interpretation.values()).strip()
                    else:
                        # Unexpected structure in RepeatedLabelError
                        print(f"Warning: Unexpected structure in RepeatedLabelError for '{entity_text}': {first_interpretation}")
                # Fallback for RepeatedLabelError if no components or unexpected structure
                return entity_text.title()
            elif components and isinstance(components, dict):  # components is a single OrderedDict
                # Join its values, ensuring they are strings
                return " ".join(str(v) for v in components.values()).strip()
            else:
                # No components found or unexpected type, fallback
                return entity_text.title()
        except Exception as e:
            print(f"Error normalizing location '{entity_text}': {e}")
        # Fallback for any error or if no specific case matched
        return entity_text.title()

    def normalize_entity(self, entity: Dict[str, Union[str, int, int]]) -> Dict[str, Union[str, int, int]]:
        """
        Normalize an entity based on its label.
        """
        normalized_entity = entity.copy()
        text = str(entity['entity']) # Ensure text is initially a string
        label = entity['label']
        
        if label == 'LOC':
            normalized_entity['entity'] = self.normalize_location(text)
        elif label == 'ORG':
            normalized_entity['entity'] = self.normalize_organization(text)
        elif label == 'PER':
            normalized_entity['entity'] = self.normalize_person(text)
        elif label == 'MISC':
            normalized_country = self.normalize_country(text)
            if normalized_country != text:
                normalized_entity['entity'] = normalized_country
                normalized_entity['label'] = 'LOC'
        
        return normalized_entity

    def normalize_entities(self, entities: List[Dict[str, Union[str, int, int]]]) -> List[Dict[str, Union[str, int, int]]]:
        """
        Normalize a list of entities and deduplicate based on normalized text.
        """
        normalized_entities = [self.normalize_entity(entity) for entity in entities]
        seen = set()
        unique_entities = []
        for entity in normalized_entities:
            normalized_text = entity['entity']
            if normalized_text not in seen:
                seen.add(normalized_text)
                unique_entities.append(entity)
        return unique_entities

    def __call__(self, entities: List[Dict[str, Union[str, int, int]]]) -> List[Dict[str, Union[str, int, int]]]:
        """
        Alias for normalize_entities method to allow direct calling of the class instance.
        """
        return self.normalize_entities(entities) 