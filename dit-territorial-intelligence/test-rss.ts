async function test() {
  try {
    const res = await fetch('https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-BR&q=Alagoinhas');
    const xml = await res.text();
    const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));
    console.log('Items found:', itemMatches.length);
    
    for (const match of itemMatches.slice(0, 1)) {
        const block = match[1];
        const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
          .replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        console.log('Title:', title);
    }
  } catch (err) {
    console.error(err);
  }
}
test();
