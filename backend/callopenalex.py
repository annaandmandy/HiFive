import requests
from typing import Dict, List, Optional, Union
from datetime import datetime, date
import time

class OpenAlexAPI:
    
    def __init__(self, email: Optional[str] = None, rate_limit: float = 0.1):
        self.base_url = "https://api.openalex.org"
        self.email = email
        self.rate_limit = rate_limit
        self.last_request_time = 0
    
    def _rate_limit_wait(self):
        if self.rate_limit > 0:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.rate_limit:
                time.sleep(self.rate_limit - elapsed)
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint: str, params: Dict) -> Dict:
        self._rate_limit_wait()
        
        if self.email:
            params['mailto'] = self.email
        
        try:
            response = requests.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            print(f"HTTP Error: {e}")
            print(f"Response: {response.text}")
            raise
        except Exception as e:
            print(f"Error: {e}")
            raise
    

    def search_works(
        self,
        query: Optional[str] = None,
        filter_params: Optional[Dict] = None,
        sort: Optional[str] = None,
        per_page: int = 25,
        page: int = 1,
        publication_year: Optional[Union[str, int, List[int]]] = None,
        publication_date: Optional[Union[str, date]] = None,
        cited_by_count: Optional[Union[str, int]] = None,
        is_oa: Optional[bool] = None,
        type: Optional[str] = None,
        institutions_id: Optional[str] = None,
        authors_id: Optional[str] = None,
        concepts_id: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Search for works with comprehensive filtering
        
        Args:
            query: Search query string
            filter_params: Dictionary of filter parameters (see OpenAlex docs)
            sort: Sort order (e.g., 'cited_by_count:desc', 'publication_date:desc')
            per_page: Results per page (1-200, default: 25)
            page: Page number (default: 1)
            
        Quick filters (shortcuts):
            publication_year: Year(s) to filter
                - Single year: 2023
                - Year range: "2020-2023"
                - List: [2020, 2021, 2022]
            publication_date: Date to filter (single date only)
                - Single date: "2023-01-01"
                - For date ranges, use filter_params with from_publication_date/to_publication_date
            cited_by_count: Citation count filter
                - Exact: 100
                - Range: ">50", "<100", "50-100"
            is_oa: Open access filter (True/False)
            type: Work type ('article', 'book-chapter', 'dissertation', etc.)
            institutions_id: Institution OpenAlex ID
            authors_id: Author OpenAlex ID
            concepts_id: Concept/Topic OpenAlex ID
            
        Returns:
            Dictionary with 'results' and metadata
            
        Examples:
            # Basic search
            api.search_works("machine learning")
            
            # Year filter
            api.search_works("AI", publication_year=2023)
            
            # Year range
            api.search_works("climate", publication_year="2020-2023")
            
            # Date range (use filter_params)
            api.search_works(
                filter_params={
                    'from_publication_date': '2023-01-01',
                    'to_publication_date': '2023-06-30'
                }
            )
            
            # Multiple filters
            api.search_works(
                "quantum computing",
                publication_year=2023,
                is_oa=True,
                cited_by_count=">50",
                sort="cited_by_count:desc"
            )
            
            # Advanced filtering
            api.search_works(
                filter_params={
                    'publication_year': '2020-2023',
                    'institutions.id': 'I136199984',
                    'concepts.id': 'C154945302',  # AI concept
                    'type': 'article',
                    'is_oa': True,
                    'cited_by_count': '>100',
                    'has_fulltext': True
                },
                sort='cited_by_count:desc'
            )
        """
        params = {
            'per_page': per_page,
            'page': page
        }
        
        # Add search query
        if query:
            params['search'] = query
        
        # Build filter string
        filters = []
        
        # Use provided filter_params
        if filter_params:
            for key, value in filter_params.items():
                if isinstance(value, bool):
                    filters.append(f"{key}:{str(value).lower()}")
                else:
                    filters.append(f"{key}:{value}")
        
        # Add quick filter shortcuts
        if publication_year is not None:
            if isinstance(publication_year, list):
                filters.append(f"publication_year:{'|'.join(map(str, publication_year))}")
            else:
                filters.append(f"publication_year:{publication_year}")
        
        if publication_date is not None:
            filters.append(f"publication_date:{publication_date}")
        
        if cited_by_count is not None:
            filters.append(f"cited_by_count:{cited_by_count}")
        
        if is_oa is not None:
            filters.append(f"is_oa:{str(is_oa).lower()}")
        
        if type is not None:
            filters.append(f"type:{type}")
        
        if institutions_id is not None:
            filters.append(f"institutions.id:{institutions_id}")
        
        if authors_id is not None:
            filters.append(f"authorships.author.id:{authors_id}")
        
        if concepts_id is not None:
            filters.append(f"concepts.id:{concepts_id}")
        
        # Add any additional kwargs as filters
        for key, value in kwargs.items():
            if isinstance(value, bool):
                filters.append(f"{key}:{str(value).lower()}")
            else:
                filters.append(f"{key}:{value}")
        
        # Combine filters
        if filters:
            params['filter'] = ','.join(filters)
        
        # Add sort
        if sort:
            params['sort'] = sort
        
        return self._make_request('/works', params)
    
    def get_work(self, work_id: str) -> Dict:
        """
        Example:
            api.get_work("W2741809807")
            api.get_work("https://doi.org/10.1038/nature12373")
        """
        return self._make_request(f'/works/{work_id}', {})
    
    def get_works_by_institution(
        self,
        institution_id: str,
        years: Optional[Union[int, str, List[int]]] = None,
        **kwargs
    ) -> Dict:
        """
        Example:
            api.get_works_by_institution('I136199984', years=2023)
            api.get_works_by_institution('I136199984', years='2020-2023')
        """
        return self.search_works(
            institutions_id=institution_id,
            publication_year=years,
            **kwargs
        )
    
    def get_trending_works(
        self,
        days: int = 7,
        per_page: int = 50,
        **kwargs
    ) -> Dict:
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Use from_publication_date filter
        return self.search_works(
            filter_params={
                'from_publication_date': start_date.strftime('%Y-%m-%d')
            },
            sort='cited_by_count:desc',
            per_page=per_page,
            **kwargs
        )
    
    def search_authors(
        self,
        query: Optional[str] = None,
        filter_params: Optional[Dict] = None,
        sort: Optional[str] = None,
        per_page: int = 25,
        page: int = 1,
        **kwargs
    ) -> Dict:
        """
        Search for authors
        
        Common filters:
            - last_known_institutions.id: Institution ID
            - works_count: Number of works (e.g., '>100')
            - cited_by_count: Total citations (e.g., '>1000')
            - has_orcid: True/False
            
        Example:
            api.search_authors("John Smith", has_orcid=True)
            api.search_authors(
                filter_params={'last_known_institutions.id': 'I136199984'},
                sort='cited_by_count:desc'
            )
        """
        params = {'per_page': per_page, 'page': page}
        
        if query:
            params['search'] = query
        
        # Build filters
        filters = []
        if filter_params:
            for key, value in filter_params.items():
                if isinstance(value, bool):
                    filters.append(f"{key}:{str(value).lower()}")
                else:
                    filters.append(f"{key}:{value}")
        
        for key, value in kwargs.items():
            if isinstance(value, bool):
                filters.append(f"{key}:{str(value).lower()}")
            else:
                filters.append(f"{key}:{value}")
        
        if filters:
            params['filter'] = ','.join(filters)
        
        if sort:
            params['sort'] = sort
        
        return self._make_request('/authors', params)
    
    def get_author(self, author_id: str) -> Dict:
        """Get a specific author by ID"""
        return self._make_request(f'/authors/{author_id}', {})
    
    def search_institutions(
        self,
        query: Optional[str] = None,
        filter_params: Optional[Dict] = None,
        sort: Optional[str] = None,
        per_page: int = 25,
        **kwargs
    ) -> Dict:
        """
        Search for institutions
        
        Common filters:
            - country_code: 2-letter code (e.g., 'US')
            - type: 'education', 'healthcare', 'company', etc.
            - works_count: Number of works
            - cited_by_count: Total citations
            
        Example:
            api.search_institutions("Boston University")
            api.search_institutions(
                filter_params={'country_code': 'US', 'type': 'education'},
                sort='works_count:desc'
            )
        """
        params = {'per_page': per_page}
        
        if query:
            params['search'] = query
        
        filters = []
        if filter_params:
            for key, value in filter_params.items():
                filters.append(f"{key}:{value}")
        
        for key, value in kwargs.items():
            filters.append(f"{key}:{value}")
        
        if filters:
            params['filter'] = ','.join(filters)
        
        if sort:
            params['sort'] = sort
        
        return self._make_request('/institutions', params)
    
    def get_institution(self, institution_id: str) -> Dict:
        """Get a specific institution by ID"""
        return self._make_request(f'/institutions/{institution_id}', {})
    
  
    def search_concepts(
        self,
        query: Optional[str] = None,
        filter_params: Optional[Dict] = None,
        sort: Optional[str] = None,
        per_page: int = 25,
        **kwargs
    ) -> Dict:
        """
        Search for concepts (research topics/fields)
        
        Common filters:
            - level: Concept level (0-5, where 0 is most general)
            - works_count: Number of works
            - cited_by_count: Total citations
            
        Example:
            api.search_concepts("artificial intelligence")
            api.search_concepts(filter_params={'level': '0'})  # Top-level concepts
        """
        params = {'per_page': per_page}
        
        if query:
            params['search'] = query
        
        filters = []
        if filter_params:
            for key, value in filter_params.items():
                filters.append(f"{key}:{value}")
        
        for key, value in kwargs.items():
            filters.append(f"{key}:{value}")
        
        if filters:
            params['filter'] = ','.join(filters)
        
        if sort:
            params['sort'] = sort
        
        return self._make_request('/concepts', params)
    
    def get_concept(self, concept_id: str) -> Dict:
        """Get a specific concept by ID"""
        return self._make_request(f'/concepts/{concept_id}', {})
  

    def search_sources(
        self,
        query: Optional[str] = None,
        filter_params: Optional[Dict] = None,
        sort: Optional[str] = None,
        per_page: int = 25,
        **kwargs
    ) -> Dict:
        """
        Search for sources (journals, repositories, etc.)
        
        Common filters:
            - type: 'journal', 'repository', 'conference', etc.
            - is_oa: Open access (True/False)
            - works_count: Number of works
            
        Example:
            api.search_sources("Nature")
            api.search_sources(filter_params={'is_oa': 'true', 'type': 'journal'})
        """
        params = {'per_page': per_page}
        
        if query:
            params['search'] = query
        
        filters = []
        if filter_params:
            for key, value in filter_params.items():
                if isinstance(value, bool):
                    filters.append(f"{key}:{str(value).lower()}")
                else:
                    filters.append(f"{key}:{value}")
        
        for key, value in kwargs.items():
            if isinstance(value, bool):
                filters.append(f"{key}:{str(value).lower()}")
            else:
                filters.append(f"{key}:{value}")
        
        if filters:
            params['filter'] = ','.join(filters)
        
        if sort:
            params['sort'] = sort
        
        return self._make_request('/sources', params)
    
    def get_source(self, source_id: str) -> Dict:
        """Get a specific source by ID"""
        return self._make_request(f'/sources/{source_id}', {})
    
    # ========================================================================
    # Filter Aggregations
    # ========================================================================
    
    def group_works_by(
        self,
        group_by: str,
        filter_params: Optional[Dict] = None,
        per_page: int = 200,
        **kwargs
    ) -> Dict:
        """
        Get aggregated counts of works grouped by a field
        
        Args:
            group_by: Field to group by (e.g., 'publication_year', 'concepts.id', 
                     'institutions.id', 'type', 'open_access.oa_status')
            filter_params: Filters to apply before grouping
            **kwargs: Additional filter shortcuts
            
        Returns:
            Dictionary with 'group_by' containing aggregated results
            
        Example:
            # Get paper counts by year
            api.group_works_by('publication_year')
            
            # Get top concepts in AI papers
            api.group_works_by(
                'concepts.id',
                filter_params={'concepts.id': 'C154945302'},  # AI
                per_page=50
            )
            
            # Get BU papers by type
            api.group_works_by(
                'type',
                filter_params={'institutions.id': 'I136199984'}
            )
        """
        params = {
            'group_by': group_by,
            'per_page': per_page
        }
        
        # Build filters
        filters = []
        if filter_params:
            for key, value in filter_params.items():
                if isinstance(value, bool):
                    filters.append(f"{key}:{str(value).lower()}")
                else:
                    filters.append(f"{key}:{value}")
        
        for key, value in kwargs.items():
            if isinstance(value, bool):
                filters.append(f"{key}:{str(value).lower()}")
            else:
                filters.append(f"{key}:{value}")
        
        if filters:
            params['filter'] = ','.join(filters)
        
        return self._make_request('/works', params)
    

    def autocomplete(self, entity: str, query: str) -> Dict:
        """
        Get autocomplete suggestions
        
        Args:
            entity: Entity type ('works', 'authors', 'institutions', 'concepts', 'sources')
            query: Search query
            
        Example:
            api.autocomplete('institutions', 'boston')
            api.autocomplete('authors', 'john smith')
        """
        return self._make_request(f'/autocomplete/{entity}', {'q': query})


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

def examples():
    """Comprehensive usage examples"""
    
    api = OpenAlexAPI(email="carrieff@bu.edu")
    
    print("=" * 80)
    print("OpenAlex API Enhanced - Usage Examples")
    print("=" * 80)
    
    # Example 1: Basic search
    print("\n1. Basic Search")
    print("-" * 40)
    results = api.search_works("quantum computing", per_page=5)
    print(f"Found {results['meta']['count']} results")
    for work in results['results']:
        print(f"  - {work['title']}")
        print(f"    Citations: {work['cited_by_count']} | Year: {work['publication_year']}")
    
    # Example 2: Filter by year
    print("\n2. Filter by Publication Year")
    print("-" * 40)
    results = api.search_works(
        "machine learning",
        publication_year=2023,
        per_page=5
    )
    print(f"ML papers in 2023: {results['meta']['count']}")
    
    # Example 3: Year range
    print("\n3. Year Range Filter")
    print("-" * 40)
    results = api.search_works(
        "climate change",
        publication_year="2020-2023",
        per_page=5
    )
    print(f"Climate papers 2020-2023: {results['meta']['count']}")
    
    # Example 4: Multiple filters
    print("\n4. Multiple Filters")
    print("-" * 40)
    results = api.search_works(
        "artificial intelligence",
        publication_year=2023,
        is_oa=True,
        cited_by_count=">50",
        type="article",
        sort="cited_by_count:desc",
        per_page=5
    )
    print(f"High-impact OA AI articles in 2023: {results['meta']['count']}")
    for work in results['results']:
        print(f"  - {work['title']}")
        print(f"    Citations: {work['cited_by_count']}")
    
    # Example 5: Institution filter (Boston University)
    print("\n5. Filter by Institution (Boston University)")
    print("-" * 40)
    results = api.get_works_by_institution(
        'I136199984',  # BU's OpenAlex ID
        years=2023,
        per_page=5
    )
    print(f"BU papers in 2023: {results['meta']['count']}")
    
    # Example 6: Advanced filtering
    print("\n6. Advanced Filtering")
    print("-" * 40)
    results = api.search_works(
        filter_params={
            'publication_year': '2023',
            'institutions.id': 'I136199984',  # Boston University
            'concepts.id': 'C154945302',  # Artificial Intelligence concept
            'is_oa': True,
            'has_fulltext': True,
            'type': 'article'
        },
        sort='cited_by_count:desc',
        per_page=5
    )
    print(f"BU AI papers (OA, with fulltext): {results['meta']['count']}")
    
    # Example 7: Date range
    print("\n7. Date Range Filter")
    print("-" * 40)
    results = api.search_works(
        "COVID-19",
        filter_params={
            'from_publication_date': '2023-01-01',
            'to_publication_date': '2023-06-30'
        },
        per_page=5
    )
    print(f"COVID papers (Jan-Jun 2023): {results['meta']['count']}")
    
    # Example 8: Group by (aggregation)
    print("\n8. Group By (Publication Year)")
    print("-" * 40)
    results = api.group_works_by(
        'publication_year',
        filter_params={'concepts.id': 'C154945302'}  # AI papers
    )
    print("AI papers by year:")
    for item in results['group_by'][:10]:
        print(f"  {item['key']}: {item['count']} papers")
    
    # Example 9: Search authors
    print("\n9. Search Authors")
    print("-" * 40)
    results = api.search_authors("John Smith", has_orcid=True, per_page=5)
    print(f"Found {results['meta']['count']} authors named John Smith with ORCID")
    
    # Example 10: Search institutions
    print("\n10. Search Institutions")
    print("-" * 40)
    results = api.search_institutions("Boston", country_code="US", per_page=5)
    for inst in results['results']:
        print(f"  - {inst['display_name']}")
        print(f"    Works: {inst['works_count']} | Country: {inst['country_code']}")
    
    # Example 11: Trending works
    print("\n11. Trending Works (Last 7 Days)")
    print("-" * 40)
    results = api.get_trending_works(days=7, per_page=5)
    print("Recently published, highly-cited papers:")
    for work in results['results']:
        print(f"  - {work['title']}")
        print(f"    Citations: {work['cited_by_count']} | Date: {work['publication_date']}")
    
    # Example 12: Citation count ranges
    print("\n12. Citation Count Ranges")
    print("-" * 40)
    results = api.search_works(
        "deep learning",
        cited_by_count="100-500",  # Between 100 and 500 citations
        publication_year="2020-2023",
        per_page=5
    )
    print(f"Deep learning papers (100-500 citations, 2020-2023): {results['meta']['count']}")


if __name__ == "__main__":
    # Run examples
    examples()