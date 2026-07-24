import { StudyUseCase } from '../application/study';
import { DexieStudyPersistence } from '../infrastructure/study';
import { cryptoIdGenerator, webClock } from '../infrastructure/system';
import { studyDemoItems } from '../mock/questions';

const studyDemoPersistence = new DexieStudyPersistence();

export function createStudyDemoUseCase(): Promise<StudyUseCase> {
  return StudyUseCase.startOrResume(
    {
      items: studyDemoItems,
      sessionId: 'task006-demo-session-v1',
      userId: 'local-demo-user',
    },
    {
      clock: webClock,
      idGenerator: cryptoIdGenerator,
      persistence: studyDemoPersistence,
    },
  );
}
