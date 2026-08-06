import { Platform3DCanvas } from '../../../../app/ui/components/Platform3DCanvas';

export function Scene3DViewport({
  navigation,
  chrome = true,
}: {
  navigation: 'editor' | 'track';
  chrome?: boolean;
}) {
  return <Platform3DCanvas navigation={navigation} chrome={chrome} />;
}