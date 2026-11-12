"""Join account-owned likes and model bookmarks without mixing media and 3D libraries."""
import copy


def collect_favorites(payload, likes, model_favorites):
    liked = {tuple(pair) for pair in likes if isinstance(pair, (list, tuple)) and len(pair) == 2}
    selected = set(model_favorites)
    result = []
    for key, kind in (('projects', 'project'), ('assets', 'asset'), ('music', 'music'), ('models', 'model')):
        for original in payload.get(key, []):
            item_id = original.get('id')
            is_liked = (kind, item_id) in liked
            bookmarked = kind == 'model' and item_id in selected
            if not (is_liked or bookmarked):
                continue
            item = copy.deepcopy(original)
            item.pop('data', None)
            item['liked'] = is_liked
            if kind == 'model':
                item['favorited'] = bookmarked
            result.append({'kind': kind, 'item': item})
    return result
