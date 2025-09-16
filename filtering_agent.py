import anthropic
import os
import pandas as pd

from dotenv import load_dotenv
load_dotenv()

def generate_filter(user_query, df_crime):
    """
    Uses Claude to interpret user_query and return filtered version of df_crime.
    Returns: filtered_df, response_text
    """
    client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))

    columns = ', '.join(df_crime.columns)
    prompt = (
        f"You are a friendly data assistant. The dataset has columns: {columns}.\n"
        f"User query: '{user_query}'\n"
        "Suggest a pandas filter expression to select relevant rows, "
        "and give a friendly chatbot response, briefly describe what the filter does,  "
        "or whether you were able to extract a filter successfully or not. "
        "Format your response as:\n"
        "1. The pandas filter code (on the first line)\n"
        "2. Your friendly chatbot message (on the third line)"
    )

    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=300,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    answer = response.content[0].text if response.content else ""
    lines = answer.strip().split('\n', 1)
    filter_code = lines[0].strip() if lines else ""
    chatbot_message = lines[1].strip() if lines else "Sorry, could not interpret a filter."

    # Try to execute the filter code safely
    try:
        # Example: filter_code = "df_crime[df_crime['crime_type'] == 'Burglary']"
        filtered_df = eval(filter_code, {"df_crime": df_crime, "pd": pd})
    except Exception as e:
        filtered_df = df_crime
        chatbot_message = f"There has been error applying filter 😢 ({e})"

    return filtered_df, chatbot_message