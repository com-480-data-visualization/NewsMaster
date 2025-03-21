# **NewsMaster**

# Milestone 1

Group members:  
Eugène Bergeron,  
Florian Déjean,  
Paul Madelénat

## **Problematic**

Today, it is hard to get a glance of everything happening in the world, and what news are the most important ones. Therefore, we want to create visualizations that show immediately what are the main topics the world is talking about, and how they are connected in subject, or time.  
Most importantly, the visualizations must be so intuitive that a user understands solely from the visualizations what the key themes are without needing to read additional explanations. Therefore our target audience is anyone interested in world trends, without any prior knowledge.

To achieve this, we aim to design interactive graphics that highlight trends, connections, and evolutions of topics in real time. For example, how the theme “Silicon Valley” is connected to “Technology”. 

These visualizations should present:

- **Clustering of topics**: Showing how different news stories relate to each other.  
- **Temporal trends**: Illustrating how topics rise and fall in importance over time.  
- **Geographical relevance**: Mapping where the most discussed news originates.

The goal is to create an intuitive experience where users can grasp the world's most pressing discussions at a glance, enabling them to stay informed efficiently and effortlessly.

## **Dataset**

As a dataset, we will be using [RSS fluxs](https://en.wikipedia.org/wiki/RSS). We will gather news from different media to have a global view of today's news, but only reliable and well known sources, such as BBC, New York Times or Wired. We also know the format of each of these RSS fluxs, simplifying the pre-processing of those.

Concerning the pre-processing: everyday at an early hour (using GitHub actions), we will fetch the RSS fluxs for the previous day, and add it to a database of the seven last days.  
The preprocessing must get us from a RSS flux to visualizable data, we therefore plan to:

- Remove every article not concerning the day’s date (information visible from the pubDate tag)  
- Remove any HTML tags to isolate the relevant data (title, description/summary, pubDate (to have the time of publication)).  
- Apply modern and non modern natural language processing methods to count the words, find the link between them, clustering and topic classification and Named Entity Recognition.

Only simple and automatizable tasks that will be handle by a simple GitHub action that we already know how to make.

The RSS fluxs we plan to use include, but are not limited to: [BBC](https://feeds.bbci.co.uk/news/rss.xml), [Reuters](https://reutersbest.com/feed/), [Euronews](https://www.euronews.com/rss), [Wired](https://www.wired.com/feed/rss), [New York Times](https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml), [Google News](https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en).

## **Exploratory Data Analysis** 

*Pre-processing of the data set you chose*   
*• Show some basic statistics and get insights about the data* 

The basic format of an RSS is an array featuring title, pubDate, description, link.

- Words per news  
- Number of news and average number of words of a news per RSS (limit to last 24h news)  
- Similarity between between RSS news (similarity score)

##  **Related work** 

*• What others have already done with the data?*  
*• Why is your approach original?*  
*• What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).*   
*• In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.*

* [https://antoninfaure.ch/posts/rsstrend/](https://antoninfaure.ch/posts/rsstrend/)  
  * What others have already done with the data?  
    * RSS Trend visualizes news topic trends over time using RSS feeds, providing simple word clouds and time-based frequency analysis.  
  * Why is your approach original?  
    * NewsMaster will focus on interactive clustering of topics and their connections rather than just word frequency analysis \+ will include different charts instead of one (bubbles).  
  * What source of inspiration do you take?  
    * The idea of tracking topic trends over time is useful, but we aim for a more dynamic, interactive approach with intuitive visualizations.  
* [https://trends.google.com/trends/](https://trends.google.com/trends/)   
  * What others have already done with the data?  
    * Google Trends tracks search term popularity but does not focus on actual news articles or their relationships.  
  * Why is your approach original?  
    * Unlike Google Trends, which relies on search behavior, NewsMaster aggregates real-time news articles, showing actual media narratives rather than public interest alone.  
  * What source of inspiration do you take?  
    * We take inspiration from Google Trends’ clear visual storytelling, aiming to make news evolution and connections just as intuitive.