import styled from "@emotion/styled"
import { Stroke } from "../../../style/colors";
import { InputArea, InputAreaField, InputAreaText } from "../../UI/InputArea";
import { useAuthStore } from "../../../store/storeIndex"
import { useState } from "react";

const Wrapper = styled.div<{ show: boolean }>`
    //포지션 관련
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);

    width: 400px;
    height: 350px;
    border-radius: 10px;
    border: 1px solid ${Stroke};
    box-sizing: border-box;
    padding: 30px 30px;
    background-color: #ffffff68;
    backdrop-filter: blur(10px);
    z-index: 10000;


    display: grid;
    grid-template-rows: auto auto auto;
    gap: 40px;

    opacity:${({show}) => (show ? "1" : "0")};
    pointer-events: ${({show}) => (show ? "auto": "none")};
`

const Title = styled.div`
    font-size: 24px;
    font-weight: bold;
    box-sizing: border-box;
    font-family: Pretendard;
`
const Content = styled.div`
    font-size: 18px;
    font-family: Pretendard;
    box-sizing: border-box;
`
const QuitInput = styled.div`
    font-size: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding-bottom: 10px;
`
const QuitButton = styled.button<{Active:boolean}>`
    background-color: ${({Active}) => (Active ? "red" : "grey")};;
    width: 100%;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-size: 18px;
    font-family: Chiron Sung HK;
    pointer-events: ${({Active}) => (Active ? "auto" : "none")};

    &:active{
        transform: scale(0.95);
    }
`
const ErrorMessage = styled.div`
    height: 30px;
    color: red;
    padding: 5px 0;
    box-sizing: border-box;
`

interface Props {
    show: boolean;
}

const QuitPopup:React.FC<Props> = ({show}) => {
    const {user, quit} = useAuthStore();

    const [email, setEmail] = useState("");

    const handleQuit = () => {
        if (email === user?.email) {
            setTimeout(async () => { await quit()},1500);
        }
    }

    return(
        <Wrapper show={show} onClick={(e) => e.stopPropagation()}>
            <Title>
                정말 탈퇴 하시겠습니까?
            </Title>
            <Content>
                지금 탈퇴하면 MoleLaw에 저장된 질문들과 정보는 전부 삭제됩니다.
            </Content>
            <QuitInput>
                탈퇴를 희망하면 탈퇴를 희망하는 아이디를 적어주세요.
                <InputArea>
                <InputAreaText>
                </InputAreaText>
                <InputAreaField value={email} placeholder={user?.email} onChange={(e) => setEmail(e.target.value)}/>
                </InputArea>
                <ErrorMessage>
                    {email ? email === user?.email ? null : "이메일이 일치하지 않습니다" : null }
                </ErrorMessage>
                <QuitButton onClick={handleQuit} Active={email === user?.email}>
                    회원 탈퇴
                </QuitButton>
            </QuitInput>
        </Wrapper>
    )
}

export default QuitPopup;
