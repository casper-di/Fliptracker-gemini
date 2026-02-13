from bs4 import BeautifulSoup

def clean_html_content(html_body: str) -> str:
    soup = BeautifulSoup(html_body, "html.parser")
    # Supprime balises inutiles
    for tag in soup(['style', 'script', 'head', 'link']):
        tag.decompose()
    # Convertit en texte brut
    text = soup.get_text(separator="\n")
    # Gestion longueur
    if len(text) > 4000:
        text = text[:3000] + text[-1000:]
    return text.strip()
