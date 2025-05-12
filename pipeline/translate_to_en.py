from langdetect import detect, LangDetectException
from googletrans import Translator as GoogleTranslator
from typing import List, Optional
import asyncio
import time

class Translator:
    def __init__(self):
        """Initialize the translator with Google Translate API."""
        self.last_request_time = 0
        self.min_request_interval = 1  # Minimum seconds between requests to avoid rate limiting

    async def _translate_batch_async(self, texts: List[str]) -> List[str]:
        """
        Asynchronously translate a batch of texts to English.
        
        Args:
            texts (List[str]): List of texts to translate
            
        Returns:
            List[str]: List of translated texts in English
        """
        async with GoogleTranslator() as translator:
            # First detect languages for all texts
            source_langs = []
            for text in texts:
                try:
                    # Skip empty or whitespace-only text
                    if not text or not text.strip():
                        source_langs.append('en')  # Treat empty text as English
                        continue
                    source_langs.append(detect(text))
                except LangDetectException:
                    source_langs.append('en')  # Default to English if detection fails
            
            # Filter out English texts
            to_translate = []
            translation_map = {}  # Map to keep track of original text positions
            for i, (text, lang) in enumerate(zip(texts, source_langs)):
                if lang != 'en' and text and text.strip():  # Only translate non-empty, non-English text
                    to_translate.append(text)
                    translation_map[len(to_translate) - 1] = i
            
            if not to_translate:
                return texts
                
            # Wait to avoid rate limiting
            current_time = time.time()
            time_since_last_request = current_time - self.last_request_time
            if time_since_last_request < self.min_request_interval:
                await asyncio.sleep(self.min_request_interval - time_since_last_request)
            self.last_request_time = time.time()
            
            # Translate all non-English texts at once
            translations = await translator.translate(to_translate, dest='en')
            
            # Reconstruct the result list
            result = texts.copy()
            for i, translation in enumerate(translations):
                original_index = translation_map[i]
                result[original_index] = translation.text
                
            return result

    def translate_batch(self, texts: List[str]) -> List[str]:
        """
        Translate multiple texts to English using async bulk translation.
        
        Args:
            texts (List[str]): List of texts to translate
            
        Returns:
            List[str]: List of translated texts in English
        """
        return asyncio.run(self._translate_batch_async(texts))

    def translate(self, text: str) -> str:
        """
        Translate a single text to English.
        
        Args:
            text (str): Text to translate
            
        Returns:
            str: Translated text in English
        """
        return self.translate_batch([text])[0]

    def __call__(self, text: str) -> str:
        """
        Alias for translate method to allow direct calling of the class instance.
        
        Args:
            text (str): Text to translate
            
        Returns:
            str: Translated text in English
        """
        return self.translate(text)
