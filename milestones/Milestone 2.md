# **NewsMaster**

## Milestone 2

### Project Goal

We aim to make global news trends instantly understandable through intuitive and interactive visualizations. Our project helps users see:

- Who's talking about whom (country-to-country media attention),
- What's being talked about (keyword/topic clusters), and
- When it's trending (temporal evolution of attention and topics).

The result will be a live dashboard showing the most discussed countries, topics, and their interconnections. This serves users who want to stay updated on global narratives at a glance.

---

### Visualizations

#### World Map of Media Attention

- Import view: How often a country is mentioned in *other countries'* news.
- Export view: How often a country's *media talks about* other countries.
- Interaction: Hover to view breakdown, switch between import/export.

![World Map Visualization](res/world_map.png)

#### Keyword Bubble Chart (Network of News Topics)

- Each node = a trending named entity or keyword
- Links = co-occurrence in the same article
- Size = frequency
- Edge thickness = strength of co-occurrence

![Bubble Chart Keyword](res/bubble_chart.png)

![Bubble Chart Keyword](res/bubble_chart.png)

#### Temporal Trend Rankings

- Rankings of top 10 topics over past in a week. Shown as a histogram of the % of appearances of the topic in the articles of the selected week.
- Interactions:
  - Hovering a bar displays the total number of appearances.
  - Clicking a bar displays a new graph, showing the trending of this topics over the weeks.

<img src="res/temporal_trend.jpg" alt="Temporal Trend Visualization" width="45%">

### Roadmap

#### ML

- [ ] Parse RSS feeds Action, clean them (TODO add link)
- [ ] Apply NLP (Named Entity Recognition, Trend)
- [ ] Docs to explain the model and choice of hyperparameter
- [ ] Docs to explain the dataset format
  
#### SWE

- [X] website deployment via git action
- [ ] page design and layout
- [ ] Add graph libraries and try them out
- [ ] Design the graphs with dummy data
- [ ] Link the dataset with the graphs

---

### Tools & Lecture Needs

| Component               | Tools / Libraries                | Related Lectures / Resources          |
|------------------------|----------------------------------|----------------------------------------|
| Map                    | D3.js, TopoJSON, Leaflet (maybe) | D3.js lectures, Map projections       |
| NLP                    | spaCy, NLTK, scikit-learn        | NLP in Python, Topic modeling basics  |
| Bubble & Trend Charts  | D3.js, Plotly.js, Chart.js       | Graph viz & Time series lectures      |
| Backend + Cron         | Python, GitHub Actions           | Data pipeline & automation practices  |

### Relevant Lectures

#### Map Visualization

- Maps & Practical Maps (8_1, 8_2) - Projections, GeoJSON/TopoJSON, D3 implementation
- D3.js (4_2) - Geographic data binding and rendering
- Web Development (1_2) - SVG essentials

#### NLP & Data Processing

- Introduction to Data Viz (1_1) - Basic NLP and clustering concepts
- *Note: Additional NLP resources needed for implementation*

#### Charts & Interactivity

- D3.js (4_2) - Lines, paths, dynamic updates
- Interaction (5_1, 5_2) - Linking, brushing, transitions
- Design Principles (6_2, 7_1) - Marks, channels, multi-dimensional viz
- Perception & Colors (6_1) - Visual encoding choices

#### General Visualization

- Design Principles (7_1, 7_2) - Clarity, purpose, best practices
- Mark & Channel Theory (6_2) - Core visual encoding principles

---
The images of this document have been produced with the help of OpenAI tools.
