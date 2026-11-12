import unittest
from community_favorites import collect_favorites


class FavoriteTests(unittest.TestCase):
    def test_media_and_model_bookmarks_join_without_duplicates(self):
        source={'assets':[{'id':'image','kind':'image','data':'large'}], 'music':[{'id':'music'}],
                'models':[{'id':'model','assetType':'3d'}]}
        result=collect_favorites(source,{('asset','image'),('music','music'),('model','model')},{'model'})
        self.assertEqual(len(result),3)
        self.assertNotIn('data',result[0]['item'])
        self.assertTrue(result[-1]['item']['liked'])
        self.assertTrue(result[-1]['item']['favorited'])
        self.assertNotIn('liked',source['models'][0])

    def test_starred_model_without_a_like_is_collected(self):
        result=collect_favorites({'models':[{'id':'model'}]},[],{'model'})
        self.assertEqual(len(result),1)
        self.assertFalse(result[0]['item']['liked'])
        self.assertTrue(result[0]['item']['favorited'])

    def test_deleted_or_unshared_content_is_not_returned(self):
        self.assertEqual(collect_favorites({},[('asset','gone')],{'gone'}),[])

    def test_accounts_have_independent_collections(self):
        payload={'assets':[{'id':'image'}],'models':[{'id':'model'}]}
        self.assertEqual(len(collect_favorites(payload,[('asset','image')],{'model'})),2)
        self.assertEqual(collect_favorites(payload,[],set()),[])


if __name__=='__main__':unittest.main()
