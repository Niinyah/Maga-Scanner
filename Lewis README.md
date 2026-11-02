# Lewis (2018) Alternative Influence Network: graph-ready extraction

Source: Rebecca Lewis, *Alternative Influence: Broadcasting the Reactionary Right on YouTube*, Data & Society, 2018.
Edge definition (Lewis): two influencers appeared in the same YouTube video between 1 Jan 2017 and 1 Apr 2018. Edges are undirected and unweighted.

## Files
| File | Contents |
|---|---|
| `lewis_people.csv` | 65 people: 60 drawn in Fig. 1, plus 5 named in Appendix B only (`in_figure=false`) |
| `lewis_channels.csv` | Appendix B channel names mapped to Recfluence `channelId`, with Recfluence tags and human-review count. Blank ID = not in the Recfluence export |
| `lewis_edges.csv` | 471 `APPEARED_WITH` edges with confidence, pixel scores and endnote evidence |
| `lewis_edges_overlay.png` | Extracted edges drawn over Fig. 1 for visual checking |

## How the edges were extracted
The figure is a raster image. Edges were read from pixels:
1. Detected the 60 node squares by colour and size, and matched them to the label text in the PDF (labels are real text with coordinates).
2. For each of the 1,770 node pairs, sampled the straight line between them and measured:
   - **coverage**: share of points where something is drawn
   - **ridge**: share of points where the line is darker than pixels 3–4 px beside it, which separates a real line from crossings
3. Rule: coverage ≥ 0.99 and ridge ≥ 0.80 counts as an edge.

## Validation
- **Text-cited collaborations:** all 23 collaborations the report cites with a video URL (endnotes 14–114) between people in the figure were detected.
- **Known non-edge:** the report says Peterson and Spencer "have never collaborated directly." That pair was rejected (coverage 0.47).
- **Node size and colour:** these encode betweenness and closeness centrality. Recomputed on the extracted graph, they agree with the figure: Spearman ρ = 0.90 for size vs betweenness and 0.95 for colour vs closeness.

## Confidence levels
- `high` (408 edges, including 3 text-only edges involving people not in the figure): clean line.
- `medium` (44): accepted, but a third node sits on the line (A–B–C almost collinear). Pixels cannot tell an A–C line from A–B plus B–C. Treat as probable.
- `check` (19): line partly hidden or faint. Verify by eye, or drop.

## Known gaps
- 14 of the 60 figure people have no channel in the Recfluence export (banned or deleted), so they exist as `Person` nodes with no category.
- Recfluence labels are from later than Lewis's 2017–18 window. Store both periods; don't present them as simultaneous.
- Some matches are renamed channels (Brittany Sellner = Pettibone, Annand Virk = Bunty King, Ayla Wife = Wife with a Purpose). They're flagged in `note`.

## Example Neo4j import
```cypher
LOAD CSV WITH HEADERS FROM 'file:///lewis_people.csv' AS r
MERGE (p:Person {id: r.person_id}) SET p.name = r.name, p.inFigure = r.in_figure = 'true';

LOAD CSV WITH HEADERS FROM 'file:///lewis_channels.csv' AS r
WITH r WHERE r.recfluence_channel_id <> ''
MATCH (p:Person {id: r.person_id})
MERGE (c:Channel {channelId: r.recfluence_channel_id})
MERGE (p)-[x:RUNS]->(c) SET x.listedByLewis = r.listed_by_lewis = 'true';

LOAD CSV WITH HEADERS FROM 'file:///lewis_edges.csv' AS r
MATCH (a:Person {id: r.a}), (b:Person {id: r.b})
MERGE (a)-[e:APPEARED_WITH]-(b)
SET e.confidence = r.confidence, e.source = 'Lewis 2018, Fig. 1',
    e.period = '2017-01-01/2018-04-01', e.evidence = r.evidence;
```
