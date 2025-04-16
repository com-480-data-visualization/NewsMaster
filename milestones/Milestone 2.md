## 📰 NewsMaster — Milestone 2

### Project Goal

We aim to make global news trends instantly understandable through intuitive and interactive visualizations. Our project helps users see:

- Who’s talking about whom (country-to-country media attention),
- What’s being talked about (keyword/topic clusters), and
- When it’s trending (temporal evolution of attention and topics).

The result will be a live dashboard showing the most discussed countries, topics, and their interconnections. This serves users who want to stay updated on global narratives at a glance.

---

### Visualizations

#### World Map of Media Attention

- Import view: How often a country is mentioned in *other countries’* news.
- Export view: How often a country’s *media talks about* other countries.
- Interaction: Hover to view breakdown, switch between import/export.

![World Map Visualization](res/world_map.png)

#### Keyword Bubble Chart (Network of News Topics)

- Each node = a trending named entity or keyword
- Links = co-occurrence in the same article
- Size = frequency
- Edge thickness = strength of co-occurrence

#### Temporal Trend Ranking (Google Trends-style)

- Daily rankings of top-mentioned topics or countries over past 7 days.
- Interactive: Hovering or clicking shows how a topic evolved over time.

### Roadmap

#### ML

- Parse RSS feeds (BBC, NYT, Reuters, etc.)
- Clean + store past 7 days’ news articles
- Apply NLP (Named Entity Recognition, Trend)
  
#### SWE

- website up via git action
- page design
- graph skeleton
- link skeleton with pipelin

---

### 📚 Tools & Lecture Needs

| Component               | Tools / Libraries                | Related Lectures / Resources          |
|------------------------|----------------------------------|----------------------------------------|
| Map                    | D3.js, TopoJSON, Leaflet (maybe) | D3.js lectures, Map projections       |
| NLP                    | spaCy, NLTK, scikit-learn        | NLP in Python, Topic modeling basics  |
| Bubble & Trend Charts  | D3.js, Plotly.js, Chart.js       | Graph viz & Time series lectures      |
| Backend + Cron         | Python, GitHub Actions           | Data pipeline & automation practices  |

---
