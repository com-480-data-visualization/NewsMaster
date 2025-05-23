# **NewsMaster** - Milestone 2

## Project Goal

We aim to make global news trends instantly understandable through intuitive and interactive visualizations. Our project helps users see:

- Who's talking about whom (country-to-country media attention),
- What's being talked about (keyword/topic clusters), and
- When it's trending (temporal evolution of attention and topics).

The result will be a live dashboard showing the most discussed countries, topics, and their interconnections. This serves users who want to stay updated on global narratives at a glance.

## Visualizations

### 1) World Map of Media Attention

#### Description & sketch

- **Import view**: How often a country is mentioned in *other countries'* news.
- **Export view**: How often a country's *media talks about* other countries.
- **Interactions**:
  - Hover for a view breakdown
  - Switch button to switch between import/export view

<img src="res/world_map.png" alt="World Map Visualization" width="45%">

#### Tools & lectures needed  

**Tools**:  

- D3.js  
- TopoJSON  
- Leaflet (maybe)  

**Lectures**:  

- 4_2_D3
- 5_1_Interaction
- 6_1_Perception_colors
- 6_2_Mark_channel
- 8_1_Maps
- 8_2_Practical_maps

### 2) Keyword Bubble Chart

- **Node**: a named entity or keyword
  - *size*: number of articles where the keyword occurs
- **Edges**: co-occurence in the same article
  - *thickness*: number of co-occurrences

<img src="res/bubble_chart.png" alt="Bubble Chart Keyword" width="45%">

#### Tools & lectures needed

**Tools**:

- D3.js
- Plotly.js
- Chart.js

**Lectures**:

- 4_2_D3
- 6_2_Mark_channel
- 9_Text
- 10_Graphs

### 3) Temporal Trend Rankings

- **View**: Ranking of top 10 topics over past in a week. Shown as a histogram of the % of occurence of the topic in the articles of the selected week, ordered.
- **Interactions**:
  - Hover a bar displays the total number of appearances
  - Click a bar displays a new graph, showing the trending of this topics over the weeks

<img src="res/temporal_trend.jpg" alt="Temporal Trend Visualization" width="45%">

#### Tools & lectures needed

**Tools**:

- D3.js
- Plotly.js
- Chart.js

**Lectures**:

- 4_2_D3.pdf
- 5_1_Interaction
- 6_1_Perception_colors
- 6_2_Mark_channel
- 11_1_Tabular_data

## Roadmap for the core website  

First, let's have a look a our data flow :

<img src="res/pipeline.excalidraw.svg" alt="Data flow" width="30%">

### ML

- [ ] Parse RSS feeds and sanitize them `ingestor_clean.py`
- [ ] Apply NLP Named Entity Recognition with TBD `named_entity_recognition.py`
- [ ] Apply NLP Trend Analysis with BERTopic `trend_analysis.py`
- [ ] Format the NLP analysis into  `graph_processing.py`
  
### Website development

The skeleton is [available here](https://newsmaster-dashboard.netlify.app/).

- [x] Website deployment via git action
- [ ] Page design and layout
- [ ] Add graph libraries and try them out
- [ ] Design the graphs with dummy data
- [ ] Link the dataset with the graphs

## Additional ideas  

- Interactive timeline for major news events
- Add a trend analysis
- Country comparison tool to see side-by-side media coverage differences
- Topic clustering visualization showing related news categories
- Mobile-responsive design for on-the-go news trend monitoring
- News source breakdown to show media diversity per topic/country

---
The images of this document have been produced with the help of OpenAI tools.
