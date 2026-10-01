import asyncio
import httpx
async def test():
    gql = '''query GetUserByUsername($username: String!) {
              hospilot_app_users(where: {username: {_eq: $username}}, limit: 1) {
                id username password_hash display_name role org_id status
              }
            }'''
    r = httpx.post('http://localhost:8080/v1/graphql', 
                   headers={'x-hasura-admin-secret': 'hospilot-dev-secret'}, 
                   json={'query': gql, 'variables': {'username': 'admin'}})
    print(r.json())
asyncio.run(test())
